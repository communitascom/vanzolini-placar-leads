-- ============================================================
-- ROLLBACK: placar() como estava ANTES da regra anti-refire de
-- 90 dias (25/07/2026). A regra anterior era "1 lead = 1 email
-- por curso no periodo consultado" (20/07/2026), que nao
-- protegia contra recontagem do MESMO email em dias diferentes
-- quando o webhook reenviava payload de conversao antiga.
--
-- Causa raiz descoberta em 25/07: automacoes/listas do RD tocam
-- o contato e o webhook reenvia a ultima conversao como se fosse
-- nova. Julho/2026 teve 73% das linhas como refire (contra 5-18%
-- em meses normais). Validado contra o RD CRM: MBA em Lideranca,
-- IA e Execucao Estrategica bateu 44 = 44 negocios criados em
-- 23/07 com a nova regra (a antiga mostrava 101).
--
-- Backups no banco:
--   _backup_funcoes: motivo "pre-fix-refire-90d 25/07/2026"
--   _backup_mediana: medianas antigas gravadas antes do recalculo
-- Para reverter: rodar este arquivo inteiro no SQL Editor, depois
-- restaurar mediana_dia a partir de _backup_mediana se necessario.
-- ============================================================

CREATE OR REPLACE FUNCTION public.placar(p_inicio date, p_fim date)
 RETURNS TABLE(curso text, tipo text, campanha_ativa boolean, campanha_inicio date, campanha_fim date, monday_item_id text, meta_ads bigint, linkedin bigint, form_prog bigint, form_pagina bigint, popup bigint, whatsapp bigint, outros bigint, leads bigint, leads_periodo_ant bigint, delta_pct numeric, media_dia numeric, mediana_dia numeric, investimento numeric, cpl numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  -- REGRA DE CONTAGEM (desde 20/07/2026): 1 lead = 1 e-mail por curso
  -- dentro do periodo consultado.
  with base as (
    select distinct on (c.curso_id, c.email) c.curso_id, c.canal_id
    from conversoes c
    where c.data_conversao::date between p_inicio and p_fim
    order by c.curso_id, c.email, c.data_conversao
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
    from (
      select distinct on (curso_id, email) curso_id
      from conversoes
      where data_conversao::date between p_inicio - (p_fim - p_inicio + 1) and p_inicio - 1
      order by curso_id, email, data_conversao
    ) x
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

-- Para restaurar as medianas antigas tambem (opcional, so se quiser
-- reverter 100%):
-- update cursos cu set mediana_dia = b.mediana_antiga
-- from _backup_mediana b
-- where cu.id = b.id and b.criado_em = (select max(criado_em) from _backup_mediana where id = b.id);
