-- ROLLBACK: marco-pre-correcao-fantasma-20260824
-- Restaura o estado de 24/08/2026 (fim do dia), ANTES de qualquer correcao
-- do bug de conversao fantasma e do canal derivado do nome da conversao.
--
-- Contexto (ver sql/fantasma_conversao_20260824.md):
--   1. A tabela conversoes recebe registros com o identificador de conversao
--      de um curso atribuido a pessoas que nunca converteram naquele curso
--      (assinatura: outra conversao real do mesmo email em ate 10 minutos,
--      com origem_raw.nome_campanha de outro curso/canal).
--   2. O canal e derivado 100% do texto de conversao_rd (sufixo -META = Meta,
--      -RD = LinkedIn etc.), ignorando o payload. 313 nomes distintos em
--      agosto, todos com exatamente 1 canal.
--
-- O que este rollback cobre: qualquer alteracao futura em dados
-- (quarentena de fantasmas, reatribuicao de canal) ou nas funcoes.
-- NAO foi feita nenhuma alteracao antes destes snapshots.

-- 1) Dados: restaurar tabelas a partir dos snapshots de 24/08/2026
--    (rodar somente o bloco da tabela que precisa voltar)

begin;
truncate conversoes;
insert into conversoes select * from _snapshot_conversoes_20260824;
commit;

-- begin;
-- truncate de_para_conversao;
-- insert into de_para_conversao select * from _snapshot_de_para_conversao_20260824;
-- commit;

-- Idem para: _snapshot_canais_20260824, _snapshot_cursos_20260824,
-- _snapshot_campanhas_20260824, _snapshot_de_para_campanha_20260824,
-- _snapshot_turmas_20260824, _snapshot_de_para_curso_sigla_20260824,
-- _snapshot_lista_placar_20260824.

-- 2) Funcoes: as 42 funcoes public foram salvas em _backup_funcoes com motivo
--    'marco-pre-correcao-fantasma-20260824...'. Para restaurar uma:
--
-- select definicao from _backup_funcoes
--  where proname = 'placar'
--    and motivo like 'marco-pre-correcao-fantasma-20260824%'
--  order by criado_em desc limit 1;
--
-- e executar a definicao retornada (CREATE OR REPLACE FUNCTION ...).

-- 3) Colunas novas: se a correcao tiver criado colunas (ex.: suspeito_fantasma,
--    contradicao), remover com:
-- alter table conversoes drop column if exists suspeito_fantasma;
-- alter table conversoes drop column if exists contradicao;
