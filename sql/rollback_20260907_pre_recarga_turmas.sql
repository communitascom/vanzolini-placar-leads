-- Ponto de retorno de 07/09/2026, antes da recarga de `turmas` pela planilha
-- GESTÃO VANZOLINI. Criado pela migration backup_20260907_antes_da_recarga_de_turmas.
--
-- O QUE ESTÁ GUARDADO NO BANCO
--   _backup_turmas_20260907      149 linhas, cópia integral de turmas
--   _backup_cursos_20260907      129 linhas, cópia integral de cursos (inclui mediana_dia)
--   _backup_funcoes_20260907     7 definições: campanhas_andamento, curva_ritmo,
--                                historico_turmas, historico_mensal, placar,
--                                midia_por_curso, recalcula_mediana
--   _backup_referencia_20260907  os números de hoje, para comparar depois
--
-- ESTADO DE HOJE
--   turmas: 149 linhas, último data_fim 20/05/2026, última inserção 13/07/2026
--   campanhas_andamento(): 25 linhas (17 no ar + 8 encerradas nos últimos 7 dias)
--   código do painel: tag marco-ajustes-20260907 (commit 374c1e6)

-- ---------------------------------------------------------------------------
-- COMO VOLTAR
-- ---------------------------------------------------------------------------

-- 1) turmas ao estado de 07/09/2026
begin;
  delete from turmas;
  insert into turmas select * from _backup_turmas_20260907;
  select setval(pg_get_serial_sequence('turmas','id'), coalesce((select max(id) from turmas),1));
commit;

-- 2) mediana_dia dos cursos (a régua Acima/Estável/Abaixo do placar)
begin;
  update cursos c set mediana_dia = b.mediana_dia
  from _backup_cursos_20260907 b where b.id = c.id;
commit;

-- 3) cursos criados depois do backup (se a recarga tiver criado curso novo)
--    confira antes de apagar:
--      select id, nome from cursos where id not in (select id from _backup_cursos_20260907);

-- 4) funções: a definição de cada uma está em _backup_funcoes_20260907.definicao.
--    Rode o texto da linha desejada:
--      select definicao from _backup_funcoes_20260907 where funcao = 'campanhas_andamento';

-- 5) conferência final: os números têm que bater com _backup_referencia_20260907
select 'agora' quando, count(*) turmas, max(data_fim) ate from turmas
union all
select 'backup', turmas, turmas_ate from _backup_referencia_20260907;
