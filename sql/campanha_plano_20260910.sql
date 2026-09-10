-- =====================================================================
-- Fase 0 do painel de performance de campanha | 10/09/2026
-- =====================================================================
-- Guarda os parametros de plano de midia que o Monday nao carrega: a verba
-- sobre a qual a meta original foi calculada e a propria meta. Sem os dois
-- nao existe CPL do plano nem meta ajustada, que sao a regua do grafico.
--
-- Divisao de fontes, decidida em 10/09:
--   tipo = 'MBA'   -> verba e meta vem daqui (plano de midia)
--   tipo = 'Curso' -> verba e datas vem de campanhas (sync do Monday)
--
-- Esta tabela e transitoria por desenho: some no dia em que o board do Monday
-- padronizar verba e meta e o sync_campanhas_monday passar a gravar os dois.
-- =====================================================================

create table if not exists public.campanha_plano (
  campanha_id    bigint      primary key references public.campanhas(id) on delete cascade,
  verba_oficial  numeric(12,2) not null check (verba_oficial > 0),
  verba_plano    numeric(12,2) not null check (verba_plano > 0),
  meta_original  integer       not null check (meta_original > 0),
  data_inicio    date,
  data_fim       date,
  fonte          text          not null default 'plano de midia',
  observacao     text,
  atualizado_em  timestamptz   not null default now(),
  -- NULLIF nas duas derivadas: a coluna gerada e avaliada antes do CHECK, entao
  -- sem ele um meta_original = 0 estoura "division by zero" em vez da mensagem
  -- do constraint. Com ele a derivada vira nula e o CHECK da o recado certo.
  cpl_plano      numeric(12,4) generated always as (verba_plano / nullif(meta_original, 0)) stored,
  meta_ajustada  integer       generated always as ((round(verba_oficial * meta_original / nullif(verba_plano, 0)))::integer) stored,
  constraint campanha_plano_janela check (
    data_inicio is null or data_fim is null or data_fim >= data_inicio
  )
);

comment on table public.campanha_plano is
  'Parametros de plano de midia por campanha, para MBA. Guarda apenas a verba VIGENTE: nao ha historico de revisao, entao releitura de periodo passado usa a verba de hoje. Nasce como fonte enquanto o board do Monday nao padroniza verba e meta; some no dia em que o sync passar a trazer os dois.';
comment on column public.campanha_plano.verba_oficial is
  'Verba que vale hoje, ja revista. Base do investimento realizado em % e da projecao pela verba.';
comment on column public.campanha_plano.verba_plano is
  'Verba sobre a qual a meta original foi calculada no planejamento. Serve so para derivar o CPL do plano.';
comment on column public.campanha_plano.meta_original is
  'Meta de leads do planejamento, casada com verba_plano.';
comment on column public.campanha_plano.cpl_plano is
  'Derivada: verba_plano / meta_original. E o CPL contra o qual o CPL real e comparado.';
comment on column public.campanha_plano.meta_ajustada is
  'Derivada: verba_oficial * meta_original / verba_plano, que e verba_oficial dividida pelo CPL do plano sem passar pelo arredondamento de cpl_plano. E a linha tracejada de meta no grafico.';
comment on column public.campanha_plano.data_inicio is
  'Excecao. Preencher so quando a janela do plano diverge da que veio do Monday; nulo significa usar campanhas.data_inicio.';
comment on column public.campanha_plano.data_fim is
  'Excecao. Preencher so quando a janela do plano diverge da que veio do Monday; nulo significa usar campanhas.data_fim.';

-- search_path fixo: nao e SECURITY DEFINER, entao nao ha escalada, mas o linter
-- do Supabase acusa function_search_path_mutable. now() vive em pg_catalog e
-- continua resolvendo com o search_path vazio.
create or replace function public.campanha_plano_toca_atualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_campanha_plano_atualizado on public.campanha_plano;
create trigger trg_campanha_plano_atualizado
  before update on public.campanha_plano
  for each row execute function public.campanha_plano_toca_atualizado();

-- Mesma postura de seguranca de institucional_plano: dado de plano so e lido
-- por RPC security definer, nunca direto pelo front.
alter table public.campanha_plano enable row level security;
revoke all on public.campanha_plano from anon, authenticated;

-- ---------------------------------------------------------------------
-- Carga dos tres MBAs com campanha registrada.
-- Casa por curso_id + data_inicio da campanha, para nao cravar id gerado.
-- ---------------------------------------------------------------------
insert into public.campanha_plano
  (campanha_id, verba_oficial, verba_plano, meta_original, data_inicio, data_fim, observacao)
select c.id, p.verba_oficial, p.verba_plano, p.meta_original, p.data_inicio, p.data_fim, p.observacao
from (values
  (43::bigint, '2026-06-25'::date, 68000.00::numeric, 70000.00::numeric, 2961, null::date, null::date,
   'Verba revista de 70.000 para 68.000. Janela igual a do Monday.'),
  (1::bigint,  '2026-05-25'::date, 60000.00::numeric, 61182.00::numeric, 2781, null::date, null::date,
   'Verba revista de 61.182 para 60.000. Janela igual a do Monday.'),
  (3::bigint,  '2026-05-25'::date, 31000.00::numeric, 30768.00::numeric, 1923, null::date, '2026-08-15'::date,
   'Verba revista de 30.768 para 31.000. Monday marca fim em 16/08, o plano e a peca aprovada fecham em 15/08; override ate confirmar qual vale.')
) as p(curso_id, data_inicio_camp, verba_oficial, verba_plano, meta_original, data_inicio, data_fim, observacao)
join public.campanhas c on c.curso_id = p.curso_id and c.data_inicio = p.data_inicio_camp
-- DO NOTHING, e nao DO UPDATE, de proposito: com valores literais no arquivo,
-- um replay deste script reverteria em silencio uma revisao de verba posterior
-- (a de 68.000 para 59.000 que esta em discussao, por exemplo). Mudar verba e
-- UPDATE deliberado, nao efeito colateral de rodar a carga de novo.
on conflict (campanha_id) do nothing;

-- O join acima casa por (curso_id, data_inicio). Se o sync do Monday mexer na
-- data de inicio, ou se a campanha ainda nao existir, o insert nao casa nada e
-- passa calado, deixando a campanha sem plano. A assercao transforma isso em
-- erro na hora da carga.
do $carga$
declare v_n integer;
begin
  select count(*) into v_n
  from public.campanha_plano pl
  join public.campanhas c on c.id = pl.campanha_id
  where c.curso_id in (1, 3, 43);
  if v_n <> 3 then
    raise exception 'campanha_plano: esperava 3 MBAs com plano, encontrei %. Confira se as campanhas dos cursos 1, 3 e 43 existem e se data_inicio ainda bate com o script.', v_n;
  end if;
end
$carga$;
