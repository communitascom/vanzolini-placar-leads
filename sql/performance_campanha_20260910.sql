-- =====================================================================
-- Fase 2 do painel de performance de campanha | RPC | 10/09/2026
-- =====================================================================
-- Duas funcoes:
--   performance_campanhas_lista()                         filtros da tela
--   performance_campanha(campanha_id, ini, fim, corte)    leitura completa
--
-- A matematica do slide mora aqui, nao no JavaScript, para tela e PDF nunca
-- divergirem entre si nem da leitura ja aprovada pelo cliente.
--
-- DECISOES QUE ESTAO CRAVADAS NESTE ARQUIVO
--
-- 1. Grao. A midia e agregada por (curso_id, dia) ANTES de encontrar os leads.
--    midia_diaria tem varias linhas por dia, uma por plataforma, conta,
--    campanha e grupo; leads_validos tem uma contagem por dia. Juntar direto
--    multiplicaria os leads pelo numero de linhas de midia do dia.
--
-- 2. Fonte da meta por tipo, nunca por nulidade. MBA le campanha_plano, curso
--    comum le campanhas.meta (Monday). Usar coalesce funcionaria hoje por
--    acidente, porque meta e nula nas 42 linhas, e quebraria em silencio no dia
--    em que o Monday comecar a preencher.
--
-- 3. Override de data do plano resolvido coluna a coluna: preencher so data_fim
--    nao arrasta data_inicio junto.
--
-- 4. Arredondamento uma vez so. O dia e arredondado a 2 casas e o agregado e a
--    soma dos dias arredondados, entao somar a coluna da tela fecha com o KPI.
--    Contra a soma crua da view isso da alguns centavos, o que esta documentado
--    e e preferivel a tela que nao fecha consigo mesma.
--
-- 5. p_ini/p_fim recortam PERIODO e desligam a projecao, porque projetar um
--    pedaco de campanha e extrapolar pedaco. p_corte e data DE REFERENCIA: a
--    campanha inteira como estava naquele dia, com projecao viva.
--
-- 6. Projecao so com dia pela frente. Campanha encerrada devolve projecao nula
--    e a tela mostra entrega realizada no lugar.
--
-- LIMITE CONHECIDO DO p_corte
-- Ele reproduz a MIDIA de uma data passada com fidelidade, porque midia_diaria
-- so cresce. Os LEADS seguem o estado atual de leads_validos, que e
-- reprocessada: o Liderança ate 23/08 tinha 1.904 leads na leitura daquele dia
-- e tem 1.915 hoje. Regerar o PDF exato de uma data passada exigiria congelar
-- os leads tambem, o que esta fora do escopo por decisao de 10/09.
--
-- REPRODUCAO CONFERIDA em 10/09 contra a peca aprovada do Liderança, com
-- p_corte = 07/09: CPL 26,60 identico, projecao pela verba 2.556 identica,
-- pelo ritmo 2.636 identica, 13 dias restantes identicos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ATENCAO: a definicao viva das duas funcoes esta nas migrations
-- performance_campanha_fase2, performance_campanha_sem_projecao_encerrada,
-- performance_campanha_agregado_bate_com_serie, performance_campanha_data_de_corte,
-- performance_campanha_bordas e performance_campanha_revisao_codex.
-- O que segue abaixo e a versao inicial; a revisao do Codex acrescentou
-- codigos de erro nomeados, guarda de curso sem midia, leads_acumulados na
-- serie, bloco de referencia, encerrada em duas leituras, saldo e excedido de
-- verba, sinalizacao de campanhas irmas sobrepostas e datas efetivas na
-- listagem. Consultar o banco para a versao corrente.
-- ---------------------------------------------------------------------

create or replace function public.performance_campanhas_lista()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'curso', x->>'data_inicio' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'campanha_id', c.id,
      'curso_id', cu.id,
      'curso', cu.nome,
      'tipo', cu.tipo,
      'data_inicio', c.data_inicio,
      'data_fim', c.data_fim,
      'rotulo', to_char(c.data_inicio,'DD/MM/YYYY')||' a '||to_char(c.data_fim,'DD/MM/YYYY'),
      'situacao', case
        when current_date between c.data_inicio and c.data_fim then 'vigente'
        when c.data_fim < current_date then 'encerrada'
        else 'futura' end,
      'tem_plano', exists (select 1 from public.campanha_plano pl where pl.campanha_id = c.id)
    ) as x
    from public.campanhas c
    join public.cursos cu on cu.id = c.curso_id
  ) t;
$$;

comment on function public.performance_campanhas_lista() is
  'Cursos e todas as suas campanhas, com periodo formatado e situacao, para os filtros do painel de performance.';

revoke all on function public.performance_campanhas_lista() from public;
grant execute on function public.performance_campanhas_lista() to anon, authenticated;

create or replace function public.performance_campanha(
  p_campanha_id bigint,
  p_ini date default null,
  p_fim date default null,
  p_corte date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record; v_ini date; v_fim date; v_corte date; v_dias_rest integer;
  v_leads bigint; v_custo numeric; v_cpl numeric; v_ritmo numeric;
  v_custo_dia numeric; v_restante numeric; v_serie jsonb; v_completa boolean;
  v_fim_camp date; v_ini_camp date;
begin
  select c.id, c.nome, c.curso_id, c.data_inicio, c.data_fim, c.verba, c.meta,
         cu.nome as curso, cu.tipo,
         pl.campanha_id is not null as tem_plano,
         pl.verba_oficial, pl.verba_plano, pl.meta_original,
         pl.cpl_plano, pl.meta_ajustada,
         pl.data_inicio as plano_inicio, pl.data_fim as plano_fim
    into r
    from public.campanhas c
    join public.cursos cu on cu.id = c.curso_id
    left join public.campanha_plano pl on pl.campanha_id = c.id
   where c.id = p_campanha_id;

  if not found then
    return jsonb_build_object('erro', 'campanha nao encontrada', 'campanha_id', p_campanha_id);
  end if;

  -- Janela da campanha: override do plano vale coluna a coluna.
  v_ini_camp := coalesce(r.plano_inicio, r.data_inicio);
  v_fim_camp := coalesce(r.plano_fim,    r.data_fim);
  v_ini := v_ini_camp;
  v_fim := v_fim_camp;
  if p_ini is not null then v_ini := greatest(v_ini, p_ini); end if;
  if p_fim is not null then v_fim := least(v_fim, p_fim);    end if;

  -- Corte: ultimo dia fechado. A midia atrasa um dia, entao e ela quem manda.
  -- p_corte puxa a leitura para tras, para reproduzir uma data passada.
  select least(v_fim, max(m.data)) into v_corte from public.midia_diaria m;
  if p_corte is not null then v_corte := least(v_corte, p_corte); end if;
  if v_corte is null or v_corte < v_ini then
    return jsonb_build_object(
      'erro', 'sem dado de midia carregado para esta janela',
      'campanha_id', p_campanha_id, 'janela_ini', v_ini, 'janela_fim', v_fim);
  end if;

  -- Projeta quando a janela e a campanha inteira. Data de corte nao tira isso.
  v_completa  := (v_ini = v_ini_camp) and (v_fim = v_fim_camp);
  v_dias_rest := greatest((v_fim_camp - v_corte), 0);

  with dias as (
    select d::date as dia from generate_series(v_ini, v_corte, interval '1 day') d
  ),
  midia as (  -- agregada por dia ANTES de encontrar os leads
    select v.data as dia, sum(v.custo_real) as custo
      from public.vw_midia_custo_real v
     where v.curso_id = r.curso_id and v.data between v_ini and v_corte
     group by v.data
  ),
  leads as (
    select lv.dia, count(*)::bigint as leads
      from public.leads_validos lv
     where lv.curso_id = r.curso_id and lv.dia between v_ini and v_corte
     group by lv.dia
  ),
  linha as (  -- arredonda uma vez, e todo mundo depois usa este numero
    select d.dia, coalesce(l.leads, 0) as leads, round(coalesce(m.custo, 0), 2) as custo
      from dias d
      left join midia m on m.dia = d.dia
      left join leads l on l.dia = d.dia
  )
  select jsonb_agg(jsonb_build_object('dia', dia, 'leads', leads, 'custo', custo) order by dia),
         coalesce(sum(leads), 0), coalesce(sum(custo), 0)
    into v_serie, v_leads, v_custo
    from linha;

  v_cpl := round(v_custo / nullif(v_leads, 0), 2);

  select round(avg(x.leads), 2), round(avg(x.custo), 2)
    into v_ritmo, v_custo_dia
    from (select (e->>'leads')::numeric as leads, (e->>'custo')::numeric as custo
            from jsonb_array_elements(v_serie) e
           order by e->>'dia' desc limit 14) x;

  v_restante := greatest(
    case when r.tipo = 'MBA' then r.verba_oficial else r.verba end - v_custo, 0);

  return jsonb_build_object(
    'campanha', jsonb_build_object(
      'id', r.id, 'nome', r.nome, 'curso_id', r.curso_id, 'curso', r.curso,
      'tipo', r.tipo, 'data_inicio', r.data_inicio, 'data_fim', r.data_fim,
      'tem_plano', r.tem_plano,
      'encerrada', v_fim_camp < current_date),
    'plano', jsonb_build_object(
      'fonte', case when r.tipo = 'MBA' then 'plano de midia' else 'Monday' end,
      'verba_oficial', case when r.tipo = 'MBA' then r.verba_oficial else r.verba end,
      'verba_plano',   case when r.tipo = 'MBA' then r.verba_plano   else null end,
      'meta_original', case when r.tipo = 'MBA' then r.meta_original else null end,
      'cpl_plano',     case when r.tipo = 'MBA' then r.cpl_plano
                            else round(r.verba / nullif(r.meta, 0), 4) end,
      'meta_ajustada', case when r.tipo = 'MBA' then r.meta_ajustada else r.meta end),
    'janela', jsonb_build_object(
      'ini', v_ini, 'fim', v_fim, 'corte', v_corte,
      'campanha_ini', v_ini_camp, 'campanha_fim', v_fim_camp,
      'dias_corridos', (v_corte - v_ini) + 1,
      'dias_restantes', v_dias_rest,
      'campanha_inteira', v_completa),
    'realizado', jsonb_build_object(
      'leads', v_leads, 'investimento', v_custo, 'cpl_real', v_cpl,
      'ritmo_14', v_ritmo, 'custo_dia_14', v_custo_dia,
      'verba_restante', round(v_restante, 2)),
    -- Projecao so com dia pela frente e CPL apurado. Campanha encerrada devolve
    -- nulo, e a tela mostra entrega realizada no lugar.
    'projecao', case when v_completa and v_dias_rest > 0 and v_cpl is not null
      then jsonb_build_object(
        'teto_dia', round(v_restante / v_dias_rest, 2),
        'pela_verba', v_leads + round(v_restante / nullif(v_cpl, 0)),
        'pelo_ritmo', v_leads + round(coalesce(v_ritmo, 0) * v_dias_rest))
      else null end,
    'serie', coalesce(v_serie, '[]'::jsonb));
end;
$$;

comment on function public.performance_campanha(bigint, date, date, date) is
  'Leitura completa de uma campanha para o painel: cabecalho, janela, serie diaria de leads e custo real, agregados e projecoes. p_ini/p_fim recortam o periodo e desligam a projecao; p_corte reproduz a leitura de uma data passada mantendo a projecao.';

revoke all on function public.performance_campanha(bigint, date, date, date) from public;
grant execute on function public.performance_campanha(bigint, date, date, date) to anon, authenticated;
