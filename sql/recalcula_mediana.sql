-- =====================================================================
-- Recalcula cursos.mediana_dia ("Esperado" / coluna Situação do placar)
-- na régua de pessoas: 1 lead = 1 e-mail por curso.
--
-- BASE: dias dentro das janelas de campanha, tiradas da tabela `turmas`
-- (data_inicio a data_fim de cada turma). Dias de campanha SEM lead entram
-- como zero, de propósito: um dia de campanha parada é um zero real e deve
-- puxar a mediana para baixo.
--
-- Por que `turmas` e não "dias com lead": fora da campanha ainda pinga lead
-- residual de página antiga e orgânico. Incluir esses dias afunda a mediana
-- e faz todo curso parecer "Acima". Validado contra os valores originais da
-- planilha: a base de turmas reproduz dentro de 1 a 2 pontos, a base de
-- "dias com lead" errava até 4x (Gerenciamento da Rotina dava 2,0 onde o
-- correto é 9,0).
--
-- Cursos sem turma cadastrada, com menos de 30 dias de campanha, ou com
-- mediana zero ficam com null (a tela mostra "sem histórico").
--
-- Os valores originais da planilha estão em _backup_mediana.
-- Para reverter:
--   update cursos c set mediana_dia = b.mediana_antiga
--   from _backup_mediana b where b.id = c.id;
-- =====================================================================

-- 1. Preserva o estado atual (idempotente: só cria se ainda não existir).
create table if not exists _backup_mediana as
select id, nome, mediana_dia as mediana_antiga, now() as criado_em from cursos;

-- 2. Aplica a mediana nova sobre as janelas de campanha.
--    Ajuste a data de corte ao rodar de novo. Evite incluir meses
--    sabidamente anômalos, senão a baseline sobe artificialmente.
with janelas as (
  select distinct t.curso_id, d::date as dia
  from turmas t,
       generate_series(t.data_inicio, t.data_fim, interval '1 day') d
  where t.data_fim < '2026-07-01'
),
diario as (
  select j.curso_id, j.dia, count(distinct cv.email) as pessoas
  from janelas j
  left join conversoes cv
    on cv.curso_id = j.curso_id
   and cv.data_conversao::date = j.dia
  group by 1, 2
),
nova as (
  select curso_id,
         round(percentile_cont(0.5) within group (order by pessoas)::numeric, 1) as mediana_nova
  from diario
  group by 1
  having count(*) >= 30
)
update cursos c
set mediana_dia = case when n.mediana_nova > 0 then n.mediana_nova else null end
from nova n
where n.curso_id = c.id;

-- 3. Cursos sem nenhuma turma na janela ficam sem meta.
update cursos c
set mediana_dia = null
where c.id not in (
  select distinct curso_id from turmas where data_fim < '2026-07-01'
);
