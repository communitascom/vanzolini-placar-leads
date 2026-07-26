-- ============================================================
-- PONTO DE RETORNO: marco-historico-dinamico (25/07/2026)
--
-- Cobre a criacao do Historico Dinamico: pagina nova
-- historico-dinamico.html (mesma estrutura do historico.html,
-- dados ao vivo do Supabase) + duas funcoes SQL novas
-- (historico_mensal, historico_turmas sem parametros) + o
-- fallback de campanhas do Monday para cursos sem turma na
-- tabela `turmas`.
--
-- O historico.html (estatico, planilha) NAO foi alterado e
-- nao precisa de rollback.
--
-- Backups no banco (_backup_funcoes):
--   id 8  historico_mensal()               (unica versao, nova)
--   id 9  historico_turmas()                (versao com fallback de campanhas, atual)
--   id 10 historico_turmas(p_inicio, p_fim) (funcao PRE-EXISTENTE de sessao
--         anterior, parametros e colunas diferentes, nenhuma pagina do repo
--         chama ela hoje -- backup de seguranca, nao criada nem alterada
--         nesta sessao, NAO mexer nela ao rodar este rollback)
--   id 7  historico_turmas() versao ANTERIOR ao fallback de campanhas
--         (so turmas da planilha, sem as 9 campanhas do Monday)
--
-- Para desfazer so o fallback de campanhas (voltar pra so-turmas-xlsx),
-- restaurar o DDL do id 7. Para desfazer o recurso inteiro (apagar as
-- duas funcoes e a pagina deixa de funcionar, mas o arquivo .html
-- continua no repo ate ser removido a parte):
-- ============================================================

drop function if exists public.historico_mensal();
drop function if exists public.historico_turmas();

-- Para restaurar historico_turmas() na versao sem fallback de campanhas
-- (so turmas da planilha), rodar o DDL salvo em _backup_funcoes id 7:
-- select definicao from _backup_funcoes where id = 7;
-- e executar o resultado.
