-- ROLLBACK do 24/08/2026: volta historico_mensal() e historico_turmas() a
-- recalcular a regra anti-refire ao vivo, em vez de ler a leads_validos.
--
-- Rodar isto desfaz a correcao do timeout do Historico Dinamico e a pagina
-- volta a falhar de forma intermitente no cache frio. So use se a leitura da
-- leads_validos tiver dado algum problema de dado.
--
-- Definicoes capturadas do banco em 24/08/2026, antes da alteracao.

CREATE OR REPLACE FUNCTION public.historico_mensal()
 RETURNS TABLE(curso text, mes date, leads bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with novos as (
    select c.curso_id, c.email, c.data_conversao,
           lag(c.data_conversao) over (partition by c.curso_id, c.email order by c.data_conversao) as anterior
    from conversoes c where c.curso_id is not null
  ),
  leads_novos as (
    select curso_id, data_conversao::date as dia from novos
    where anterior is null or data_conversao - anterior > interval '90 days'
  )
  select cu.nome, date_trunc('month', ln.dia)::date, count(*)
  from leads_novos ln join cursos cu on cu.id = ln.curso_id
  group by cu.nome, date_trunc('month', ln.dia)::date
  order by 1,2;
$function$;

CREATE OR REPLACE FUNCTION public.historico_turmas()
 RETURNS TABLE(curso text, mes text, data_inicio date, data_fim date, dias integer, leads bigint, investimento numeric, cpl numeric, leads_dia numeric, turma_id bigint, inscritos integer, pagantes integer, taxa_pagante numeric, midia_real numeric, custo_total numeric, cac numeric, receita numeric, roi numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with novos as (
    select c.curso_id, c.email, c.data_conversao,
           lag(c.data_conversao) over (partition by c.curso_id, c.email order by c.data_conversao) as anterior
    from conversoes c where c.curso_id is not null
  ),
  leads_novos as (
    select curso_id, data_conversao::date as dia from novos
    where anterior is null or data_conversao - anterior > interval '90 days'
  ),
  leads_por_turma as (
    select t.id as turma_id, count(ln.dia) as leads
    from turmas t
    left join leads_novos ln on ln.curso_id = t.curso_id and ln.dia between t.data_inicio and t.data_fim
    group by t.id
  ),
  midia_por_turma as (
    select t.id as turma_id,
           coalesce(sum(m.custo) filter (where m.plataforma='Meta'),0) as midia_meta,
           coalesce(sum(m.custo),0) as midia_total
    from turmas t
    left join midia_diaria m on m.curso_id = t.curso_id and m.data between t.data_inicio and t.data_fim
    group by t.id
  ),
  cursos_sem_turma as (
    select cu.id as curso_id
    from cursos cu
    where not exists (select 1 from turmas t where t.curso_id = cu.id)
  ),
  leads_por_campanha as (
    select cmp.id as campanha_id, count(ln.dia) as leads
    from campanhas cmp
    join cursos_sem_turma cst on cst.curso_id = cmp.curso_id
    left join leads_novos ln on ln.curso_id = cmp.curso_id and ln.dia between cmp.data_inicio and cmp.data_fim
    where cmp.data_inicio is not null and cmp.data_fim is not null
    group by cmp.id
  )
  select cu.nome, to_char(t.data_fim,'YYYY-MM'), t.data_inicio, t.data_fim,
         (t.data_fim - t.data_inicio)::int,
         coalesce(lpt.leads,0),
         coalesce(t.investimento_midia,0),
         case when coalesce(lpt.leads,0)>0 and t.investimento_midia>0
              then round(t.investimento_midia/lpt.leads,2) end,
         case when (t.data_fim - t.data_inicio) > 0
              then round(coalesce(lpt.leads,0)::numeric/(t.data_fim-t.data_inicio),2) end,
         t.id,
         t.inscritos,
         t.pagantes,
         case when coalesce(t.inscritos,0)>0 then round(100.0*t.pagantes/t.inscritos,1) end,
         round(mpt.midia_total,2),
         round(mpt.midia_total + mpt.midia_meta*0.1383 + mpt.midia_total*0.10, 2),
         case when coalesce(t.pagantes,0)>0
              then round((mpt.midia_total + mpt.midia_meta*0.1383 + mpt.midia_total*0.10)/t.pagantes, 2) end,
         t.receita,
         case when (mpt.midia_total + mpt.midia_meta*0.1383 + mpt.midia_total*0.10) > 0 and t.receita is not null
              then round(t.receita/(mpt.midia_total + mpt.midia_meta*0.1383 + mpt.midia_total*0.10), 2) end
  from turmas t
  join cursos cu on cu.id = t.curso_id
  left join leads_por_turma lpt on lpt.turma_id = t.id
  left join midia_por_turma mpt on mpt.turma_id = t.id
  union all
  select cu.nome, to_char(cmp.data_fim,'YYYY-MM'), cmp.data_inicio, cmp.data_fim,
         (cmp.data_fim - cmp.data_inicio)::int,
         coalesce(lpc.leads,0),
         null::numeric,
         null::numeric,
         case when (cmp.data_fim - cmp.data_inicio) > 0
              then round(coalesce(lpc.leads,0)::numeric/(cmp.data_fim-cmp.data_inicio),2) end,
         null::bigint, null::int, null::int, null::numeric,
         null::numeric, null::numeric, null::numeric, null::numeric, null::numeric
  from campanhas cmp
  join cursos_sem_turma cst on cst.curso_id = cmp.curso_id
  join cursos cu on cu.id = cmp.curso_id
  left join leads_por_campanha lpc on lpc.campanha_id = cmp.id
  where cmp.data_inicio is not null and cmp.data_fim is not null
  order by 1,2;
$function$;
