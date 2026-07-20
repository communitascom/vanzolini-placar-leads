-- =====================================================================
-- Recalcula cursos.mediana_dia ("Esperado" / coluna Situação do placar)
-- na régua de pessoas: 1 lead = 1 e-mail por curso.
--
-- Base: mediana de pessoas distintas por dia, só nos dias com pelo menos
-- 1 lead, na janela de 12 meses definida abaixo. Cursos com menos de 20
-- dias de dado na janela ficam com null (tela mostra "sem histórico").
--
-- Ajuste as duas datas ao rodar de novo. Evite incluir meses sabidamente
-- anômalos na janela, senão a baseline sobe artificialmente.
--
-- Os valores anteriores estão em _backup_mediana.
-- Para reverter:
--   update cursos c set mediana_dia = b.mediana_antiga
--   from _backup_mediana b where b.id = c.id;
-- =====================================================================

-- 1. Preserva o estado atual antes de sobrescrever (idempotente: só cria
--    a tabela se ainda não existir; para um novo snapshot, renomeie antes).
create table if not exists _backup_mediana as
select id, nome, mediana_dia as mediana_antiga, now() as criado_em from cursos;

-- 2. Aplica a mediana nova onde há base suficiente.
with dias as (
  select curso_id, data_conversao::date d, count(distinct email) pessoas
  from conversoes
  where curso_id is not null
    and data_conversao >= '2025-07-01'
    and data_conversao <  '2026-07-01'
  group by 1, 2
),
nova as (
  select curso_id,
         round(percentile_cont(0.5) within group (order by pessoas)::numeric, 1) as mediana_nova
  from dias
  group by 1
  having count(*) >= 20
)
update cursos c
set mediana_dia = n.mediana_nova
from nova n
where n.curso_id = c.id;

-- 3. Zera (null) os cursos sem base suficiente, para não exibir ruído.
with dias as (
  select curso_id, data_conversao::date d
  from conversoes
  where curso_id is not null
    and data_conversao >= '2025-07-01'
    and data_conversao <  '2026-07-01'
  group by 1, 2
),
suficiente as (
  select curso_id from dias group by 1 having count(*) >= 20
)
update cursos c
set mediana_dia = null
where c.id not in (select curso_id from suficiente);
