-- Rollback das funcoes alteradas em 29/10/2026 (auditoria de confiabilidade com Codex).
-- Definicoes exatas exportadas do banco antes da mudanca.

-- carrega_midia_lote
CREATE OR REPLACE FUNCTION public.carrega_midia_lote(p_rows jsonb, p_desde date, p_ate date, p_origem text DEFAULT 'cron'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_t0 timestamptz := clock_timestamp();
  v_recebidas int;
  v_afetadas int := 0;
  v_antes bigint;
  v_depois bigint;
  v_novas int;
  v_atualizadas int;
  v_sem_curso int;
  v_detalhe text := null;
begin
  v_recebidas := coalesce(jsonb_array_length(p_rows), 0);

  if v_recebidas = 0 then
    raise exception 'lote vazio para o periodo % a %: nada foi gravado', p_desde, p_ate
      using hint = 'a planilha nao devolveu linhas; carga abortada de proposito';
  end if;

  select count(*) into v_antes from midia_diaria where data between p_desde and p_ate;

  with novo as (
    select
      (r->>'data')::date         as data,
      r->>'plataforma'           as plataforma,
      r->>'conta'                as conta,
      r->>'campanha'             as campanha,
      (r->>'impressoes')::bigint as impressoes,
      (r->>'cliques')::bigint    as cliques,
      (r->>'custo')::numeric     as custo,
      (r->>'leads')::bigint      as leads_plataforma
    from jsonb_array_elements(p_rows) r
  )
  insert into midia_diaria (data, plataforma, conta, campanha, impressoes, cliques, custo, leads_plataforma)
  select data, plataforma, conta, campanha, impressoes, cliques, custo, leads_plataforma
  from novo
  where data between p_desde and p_ate
  on conflict (data, plataforma, campanha, coalesce(grupo, ''::text), coalesce(conta, ''::text))
  do update set
    impressoes       = excluded.impressoes,
    cliques          = excluded.cliques,
    custo            = excluded.custo,
    leads_plataforma = excluded.leads_plataforma,
    atualizado_em    = now();

  get diagnostics v_afetadas = row_count;

  select count(*) into v_depois from midia_diaria where data between p_desde and p_ate;
  v_novas := (v_depois - v_antes)::int;
  v_atualizadas := v_afetadas - v_novas;

  -- campanhas novas que o de_para ainda nao reconhece: sinal de manutencao
  select count(distinct campanha) into v_sem_curso
  from midia_diaria
  where data between p_desde and p_ate and curso_id is null;

  if v_sem_curso > 0 then
    v_detalhe := v_sem_curso || ' campanha(s) sem curso identificado no periodo';
  end if;

  perform atualiza_leads_validos();

  insert into midia_carga_log (origem, desde, ate, linhas_recebidas, linhas_novas,
                               linhas_atualizadas, duracao_ms, status, detalhe)
  values (p_origem, p_desde, p_ate, v_recebidas, v_novas, v_atualizadas,
          (extract(epoch from (clock_timestamp() - v_t0)) * 1000)::int, 'ok', v_detalhe);

  return jsonb_build_object(
    'ok', true,
    'desde', p_desde,
    'ate', p_ate,
    'recebidas', v_recebidas,
    'novas', v_novas,
    'atualizadas', v_atualizadas,
    'campanhas_sem_curso', v_sem_curso
  );
end;
$function$
;


-- placar
CREATE OR REPLACE FUNCTION public.placar(p_inicio date, p_fim date)
 RETURNS TABLE(curso text, tipo text, campanha_ativa boolean, campanha_inicio date, campanha_fim date, monday_item_id text, meta_ads bigint, linkedin bigint, form_prog bigint, form_pagina bigint, popup bigint, whatsapp bigint, outros bigint, leads bigint, leads_periodo_ant bigint, delta_pct numeric, media_dia numeric, mediana_dia numeric, investimento numeric, cpl numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- REGRA DE CONTAGEM (25/07/2026): anti-refire de 90 dias.
  -- QUARENTENA (25/08/2026): linhas suspeito_fantasma = true sao ignoradas.
  -- FUSO (31/08/2026): o banco roda em UTC. A data do lead e o dia em
  -- America/Sao_Paulo, senao conversao das 21h em diante cai no dia seguinte.
  with novos as (
    select c.curso_id, c.email, c.canal_id, c.data_conversao,
           lag(c.data_conversao) over (partition by c.curso_id, c.email order by c.data_conversao) as anterior
    from conversoes c
    where c.curso_id is not null
      and not c.suspeito_fantasma
  ),
  leads_novos as (
    select curso_id, email, canal_id,
           (data_conversao at time zone 'America/Sao_Paulo')::date as dia
    from novos
    where anterior is null or data_conversao - anterior > interval '90 days'
  ),
  base as (
    select curso_id, canal_id
    from leads_novos
    where dia between p_inicio and p_fim
  ),
  periodo as (
    select b.curso_id,
           count(*) filter (where ca.nome = 'Meta')              as meta_ads,
           count(*) filter (where ca.nome = 'LinkedIn')          as linkedin,
           count(*) filter (where ca.nome = 'Form Programatica') as form_prog,
           count(*) filter (where ca.nome = 'Form Pagina')       as form_pagina,
           count(*) filter (where ca.nome = 'Popup')             as popup,
           count(*) filter (where ca.nome = 'WhatsApp')          as whatsapp,
           count(*) filter (where ca.nome = 'Outros')            as outros,
           count(*)                                              as leads
    from base b
    left join canais ca on ca.id = b.canal_id
    group by b.curso_id
  ),
  anterior as (
    select curso_id, count(*) as leads_ant
    from leads_novos
    where dia between p_inicio - (p_fim - p_inicio + 1) and p_inicio - 1
    group by curso_id
  ),
  invest as (
    select curso_id, sum(valor) as investimento
    from investimento_semanal
    where semana_inicio between p_inicio and p_fim
    group by curso_id
  )
  select cu.nome, cu.tipo,
         coalesce(cmp.data_inicio <= p_fim and cmp.data_fim >= p_inicio, false),
         cmp.data_inicio, cmp.data_fim, cmp.monday_item_id,
         coalesce(p.meta_ads,0), coalesce(p.linkedin,0),
         coalesce(p.form_prog,0), coalesce(p.form_pagina,0),
         coalesce(p.popup,0), coalesce(p.whatsapp,0), coalesce(p.outros,0),
         coalesce(p.leads,0), coalesce(a.leads_ant,0),
         round(100.0 * (coalesce(p.leads,0) - coalesce(a.leads_ant,0)) / nullif(a.leads_ant,0), 0),
         round(coalesce(p.leads,0)::numeric / (p_fim - p_inicio + 1), 1),
         cu.mediana_dia,
         coalesce(i.investimento,0),
         round(coalesce(i.investimento,0) / nullif(p.leads,0), 2)
  from cursos cu
  left join periodo  p on p.curso_id = cu.id
  left join anterior a on a.curso_id = cu.id
  left join invest   i on i.curso_id = cu.id
  left join lateral (
    select data_inicio, data_fim, monday_item_id
    from campanhas where curso_id = cu.id
    order by data_inicio desc limit 1
  ) cmp on true
  where cu.ativo or coalesce(p.leads,0) > 0
  order by (cu.tipo = 'Institucional'), cu.tipo, coalesce(p.leads,0) desc;
$function$
;


-- sync_campanhas_monday
CREATE OR REPLACE FUNCTION public.sync_campanhas_monday(p_items jsonb)
 RETURNS TABLE(processados integer, sem_match text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  item jsonb;
  v_curso_id bigint;
  v_processados int := 0;
  v_sem_match text[] := array[]::text[];
  v_ids text[];
begin
  select array_agg(elem->>'monday_item_id') into v_ids from jsonb_array_elements(p_items) elem;

  delete from campanhas
  where monday_item_id is not null
    and (v_ids is null or not (monday_item_id = any(v_ids)));

  for item in select * from jsonb_array_elements(p_items)
  loop
    select id into v_curso_id from cursos where lower(trim(nome)) = lower(trim(item->>'nome_curso'));
    if v_curso_id is not null then
      insert into campanhas (curso_id, nome, data_inicio, data_fim, monday_item_id)
      values (v_curso_id, 'ATIVA (Monday)', (item->>'data_inicio')::date, (item->>'data_fim')::date, item->>'monday_item_id')
      on conflict (monday_item_id) where monday_item_id is not null do update set
        curso_id = excluded.curso_id,
        data_inicio = excluded.data_inicio,
        data_fim = excluded.data_fim;
      v_processados := v_processados + 1;
    else
      v_sem_match := array_append(v_sem_match, item->>'nome_curso');
    end if;
  end loop;

  return query select v_processados, v_sem_match;
end;
$function$
;


