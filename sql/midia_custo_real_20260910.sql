-- =====================================================================
-- Fase 1 do painel de performance de campanha | custo real | 10/09/2026
-- =====================================================================
-- midia_diaria.custo e o custo de plataforma. O custo que a Vanzolini paga, e
-- o unico que faz o CPL do painel casar com o do slide aprovado, tem dois
-- encargos:
--   imposto sobre a midia Meta ..... 13,83%
--   assessoria sobre toda a midia ... 10%
--
-- A regra e por plataforma e vale igual para MBA e para curso comum. Conferido
-- em 10/09: toda linha de midia_diaria tem plataforma preenchida, e a diferenca
-- entre os tipos e so que curso comum nao roda Google. Por isso NAO existe
-- filtro nem condicao por tipo de curso aqui.
-- =====================================================================

create table if not exists public.midia_encargo (
  plataforma      text not null,
  vigente_desde   date not null default date '2024-01-01',
  imposto_pct     numeric(6,4) not null default 0 check (imposto_pct >= 0 and imposto_pct < 1),
  assessoria_pct  numeric(6,4) not null default 0 check (assessoria_pct >= 0 and assessoria_pct < 1),
  observacao      text,
  criado_em       timestamptz not null default now(),
  primary key (plataforma, vigente_desde)
);

comment on table public.midia_encargo is
  'Encargos sobre o custo de plataforma, por plataforma e por vigencia. A linha de plataforma "*" e o padrao aplicado a quem nao tem linha propria, entao plataforma nova entra ja com assessoria e sem imposto. Mudanca de aliquota e INSERT de nova vigencia, nunca UPDATE: assim relatorio antigo continua batendo.';
comment on column public.midia_encargo.vigente_desde is
  'A aliquota vale para midia com data >= este dia, ate a proxima vigencia da mesma plataforma.';

insert into public.midia_encargo (plataforma, vigente_desde, imposto_pct, assessoria_pct, observacao) values
  ('*',    date '2024-01-01', 0.0000, 0.1000, 'Padrao: so assessoria. Vale para Google, LinkedIn, TikTok e qualquer plataforma nova.'),
  ('Meta', date '2024-01-01', 0.1383, 0.1000, 'Meta paga imposto sobre a midia, alem da assessoria.')
on conflict (plataforma, vigente_desde) do nothing;

alter table public.midia_encargo enable row level security;
revoke all on public.midia_encargo from anon, authenticated;

-- O padrao "*" nao pode sumir: sem ele toda a midia cairia para encargo zero em
-- silencio, e o painel mostraria custo menor que o real sem nenhum aviso.
create or replace function public.midia_encargo_protege_padrao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.plataforma = '*'
     and (select count(*) from public.midia_encargo where plataforma = '*') <= 1 then
    raise exception 'midia_encargo: a linha de padrao "*" nao pode ser removida, e ela que garante a assessoria de quem nao tem linha propria.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_midia_encargo_protege_padrao on public.midia_encargo;
create trigger trg_midia_encargo_protege_padrao
  before delete on public.midia_encargo
  for each row execute function public.midia_encargo_protege_padrao();

-- ---------------------------------------------------------------------
-- A view NAO arredonda, de proposito. Arredondar linha a linha e depois somar
-- acumula centavos de diferenca contra o slide, que aplica os encargos sobre o
-- total do dia. Quem le arredonda no fim, uma vez so.
--
-- security_invoker ligado: a view falha fechada. Hoje anon nao tem grant
-- nenhum, mas se um dia ganhar por engano, a RLS de midia_diaria nega, em vez
-- de a view entregar o dado por ser dona.
--
-- Cada lateral resolve a aliquota que valia na DATA da linha de midia, com
-- queda para o padrao "*". O indice (curso_id, data) de midia_diaria ja existe
-- desde antes e atende o filtro da Fase 2.
-- ---------------------------------------------------------------------
create or replace view public.vw_midia_custo_real
with (security_invoker = true) as
select
  m.id, m.data, m.plataforma, m.conta, m.campanha, m.grupo, m.curso_id, m.bloco,
  m.impressoes, m.cliques, m.leads_plataforma,
  m.custo                                          as custo_plataforma,
  m.custo * e.imposto_pct                          as imposto,
  m.custo * e.assessoria_pct                       as assessoria,
  m.custo * (1 + e.imposto_pct + e.assessoria_pct) as custo_real
from public.midia_diaria m
cross join lateral (
  select coalesce(esp.imposto_pct,    pad.imposto_pct,    0) as imposto_pct,
         coalesce(esp.assessoria_pct, pad.assessoria_pct, 0) as assessoria_pct
  from (select 1) x
  left join lateral (
    select ec.imposto_pct, ec.assessoria_pct from public.midia_encargo ec
    where ec.plataforma = m.plataforma and ec.vigente_desde <= m.data
    order by ec.vigente_desde desc limit 1
  ) esp on true
  left join lateral (
    select ec.imposto_pct, ec.assessoria_pct from public.midia_encargo ec
    where ec.plataforma = '*' and ec.vigente_desde <= m.data
    order by ec.vigente_desde desc limit 1
  ) pad on true
) e;

comment on view public.vw_midia_custo_real is
  'midia_diaria com os encargos que valiam na data de cada linha. custo_real e o numero que o painel de performance usa em investimento e CPL. Sem arredondamento de proposito: quem agrega arredonda no fim.';

revoke all on public.vw_midia_custo_real from anon, authenticated;

-- ---------------------------------------------------------------------
-- Reproducao conferida em 10/09 contra as pecas aprovadas, que sairam da
-- planilha Campanhas_Vanzolini_Consolidado:
--
--   Lideranca ate 07/09 .. banco 61.208,32  peca 61.205,88  (+0,0040%)
--   Lideranca ate 23/08 .. banco 49.579,38  peca 49.576,92  (+0,0050%)
--   Lideranca ate 19/08 .. banco 46.672,72  peca 46.670,30  (+0,0052%)
--   Engenharia ate 15/08 . banco 30.549,96  peca 30.549,39  (+0,0019%)
--   IA Aplicada ate 08/08  banco 59.740,87  peca 59.740,74  (+0,0002%)
--
-- A diferenca inteira mora no Google: 13.484,00 no banco contra 13.481,86 na
-- planilha. LinkedIn bate exato e Meta difere 2 centavos. E restatement de
-- custo do Google Ads, que revisa cliques invalidos depois do fato, e o banco
-- carrega todo dia, entao ele e a fonte mais nova. Nao e erro da regra.
-- ---------------------------------------------------------------------
