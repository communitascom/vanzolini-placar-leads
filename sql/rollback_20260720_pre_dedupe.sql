-- =====================================================================
-- PONTO DE RESTAURAÇÃO | 20/07/2026
-- Estado das funções ANTES da mudança de regra de contagem de leads
-- (de "1 linha = 1 lead" para "1 e-mail por curso = 1 lead").
--
-- COMO REVERTER (opção 1, recomendada): restaura a partir da cópia
-- exata gravada na tabela _backup_funcoes, sem risco de transcrição.
-- COMO REVERTER (opção 2): rode manualmente os CREATE OR REPLACE
-- literais que estão no fim deste arquivo. Use apenas se o banco tiver
-- perdido a tabela _backup_funcoes.
--
-- Snapshot dos números de antes: tabela _backup_placar_snapshot
--   semana 13-19/07 = 8.220 leads em 65 cursos
--   junho cheio     = 4.979 leads em 65 cursos
-- =====================================================================


-- ---------------------------------------------------------------------
-- OPÇÃO 1 | Reverter a partir do backup no banco
-- ---------------------------------------------------------------------
do $$
declare d text;
begin
  for d in
    select definicao from _backup_funcoes
    where motivo = 'pre-dedupe email+curso (20/07/2026)'
  loop
    execute d;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- OPÇÃO 2 | Cópia literal (usar só se _backup_funcoes se perder)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.insere_conversao(p_email text, p_nome text, p_data_conversao timestamp with time zone, p_conversao_rd text, p_canal_raw text, p_origem_raw jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_curso_id bigint;
  v_canal_id bigint;
  v_key text;
begin
  if p_conversao_rd is null or trim(p_conversao_rd) = '' then
    v_curso_id := null;
  elsif lower(trim(p_conversao_rd)) = 'curso - baixe o programa' then
    select id into v_curso_id from cursos where nome = (p_origem_raw->>'curso_pagina');
  else
    v_key := regexp_replace(regexp_replace(upper(trim(p_conversao_rd)), '\s*\[.*$', ''), '-\d+$', '');
    select curso_id into v_curso_id from de_para_conversao where conversao_rd = v_key;
  end if;

  select id into v_canal_id from canais where nome = case p_canal_raw
    when 'Form Programa' then 'Form Programatica'
    when 'Form Página' then 'Form Pagina'
    when 'Outro' then 'Outros'
    when 'Sem conversão' then 'Outros'
    when 'Comercial/CRM' then 'Outros'
    else p_canal_raw end;

  insert into conversoes (email, nome, data_conversao, conversao_rd, curso_id, canal_id, origem_raw)
  values (lower(trim(p_email)), p_nome, p_data_conversao, p_conversao_rd, v_curso_id, v_canal_id, p_origem_raw)
  on conflict (email, data_conversao, conversao_rd) do nothing;
end;
$function$;


CREATE OR REPLACE FUNCTION public.placar(p_inicio date, p_fim date)
 RETURNS TABLE(curso text, tipo text, campanha_ativa boolean, campanha_inicio date, campanha_fim date, monday_item_id text, meta_ads bigint, linkedin bigint, form_prog bigint, form_pagina bigint, popup bigint, whatsapp bigint, outros bigint, leads bigint, leads_periodo_ant bigint, delta_pct numeric, media_dia numeric, mediana_dia numeric, investimento numeric, cpl numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  with periodo as (
    select c.curso_id,
           count(*) filter (where ca.nome = 'Meta')             as meta_ads,
           count(*) filter (where ca.nome = 'LinkedIn')         as linkedin,
           count(*) filter (where ca.nome = 'Form Programatica') as form_prog,
           count(*) filter (where ca.nome = 'Form Pagina')       as form_pagina,
           count(*) filter (where ca.nome = 'Popup')            as popup,
           count(*) filter (where ca.nome = 'WhatsApp')         as whatsapp,
           count(*) filter (where ca.nome = 'Outros')           as outros,
           count(*)                                             as leads
    from conversoes c
    left join canais ca on ca.id = c.canal_id
    where c.data_conversao::date between p_inicio and p_fim
    group by c.curso_id
  ),
  anterior as (
    select curso_id, count(*) as leads_ant
    from conversoes
    where data_conversao::date between p_inicio - (p_fim - p_inicio + 1) and p_inicio - 1
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
$function$;
