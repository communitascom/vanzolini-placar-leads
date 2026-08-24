-- =====================================================================
-- PONTO DE RETORNO do Placar de Leads Vanzolini
-- Criado em 24/08/2026, ANTES do hardening de seguranca (advisors).
--
-- Projeto Supabase: ltasijrhkotyyrxnavab
-- Script de aplicacao: sql/hardening_seguranca_20260824.sql
-- Analise dos achados: sql/hardening_seguranca_20260824.md
--
-- ATENCAO: este arquivo AINDA NAO FOI EXECUTADO no banco. A sessao que
-- o escreveu nao tinha acesso administrativo ao Supabase (MCP do
-- supabase nao conectado). Rode o BLOCO 0 abaixo ANTES de aplicar
-- qualquer coisa do hardening.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BLOCO 0 | CONGELAR O ESTADO ATUAL  (rodar primeiro, no SQL editor)
-- ---------------------------------------------------------------------

-- 0.1 definicao de todas as funcoes do public
create table if not exists _backup_funcoes (
  id          bigserial primary key,
  motivo      text,
  proname     text,
  definicao   text,
  criado_em   timestamptz default now()
);

insert into _backup_funcoes (motivo, proname, definicao)
select 'pre-hardening-seguranca-20260824',
       p.proname,
       pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f';

-- 0.2 grants de execucao por funcao (o que o hardening pode revogar)
create table if not exists _backup_grants_20260824 as
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef                                as security_definer,
       p.proconfig                                as config,
       has_function_privilege('anon',          p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f';

-- 0.3 grants e RLS por tabela/view
create table if not exists _backup_tabelas_20260824 as
select c.relname,
       c.relkind,
       c.relrowsecurity as rls_ligado,
       (select count(*) from pg_policies pol
         where pol.schemaname = 'public' and pol.tablename = c.relname) as politicas,
       has_table_privilege('anon',          c.oid, 'select') as anon_select,
       has_table_privilege('authenticated', c.oid, 'select') as auth_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','v','m','p');

-- 0.4 conferir que gravou
select motivo, count(*) from _backup_funcoes group by motivo;
select count(*) as funcoes  from _backup_grants_20260824;
select count(*) as objetos  from _backup_tabelas_20260824;

-- ---------------------------------------------------------------------
-- BASELINE DE FUNCIONAMENTO conferido em 24/08/2026, chamando a API
-- REST como anon (a mesma chave publicada no index.html).
-- Depois do hardening, TODAS estas precisam continuar respondendo 200.
-- ---------------------------------------------------------------------
--   placar(2026-08-01, 2026-08-24) ....... 200 | 79 linhas
--   campanhas_andamento() ................ 200 | 15 linhas
--   ritmo_diario() ....................... 200 | 496 linhas
--   curva_ritmo() ........................ 200 | 21 linhas
--   midia_por_curso(2026-08-01,2026-08-24) 200 | 54 linhas
--   alertas_captacao() ................... 200 | 10 linhas
--   midia_atualizada_ate() ............... 200 | 2026-08-23
--
-- Leitura direta de tabela pelo anon no mesmo momento:
--   leads_validos ......... 86.005 linhas  <-- e o que o hardening fecha
--   turmas ................... 149 linhas
--   cursos .................... 79 linhas
--   campanhas ................. 29 linhas
--   canais ...................... 7 linhas
--   conversoes, midia_diaria, investimento_semanal, de_para_conversao,
--   de_para_campanha, lista_placar, midia_carga_log ..... 0 linhas
--     (RLS ligada sem policy: o anon enxerga a tabela e nao le nada.
--      E o estado desejado, nao precisa mexer.)
--   _backup_funcoes, _snapshot_* ..... 401 permission denied (correto)

-- ---------------------------------------------------------------------
-- COMO RESTAURAR UMA FUNCAO
-- ---------------------------------------------------------------------
--   select proname, criado_em from _backup_funcoes
--   where motivo = 'pre-hardening-seguranca-20260824' order by proname;
--
--   select definicao from _backup_funcoes
--   where motivo = 'pre-hardening-seguranca-20260824' and proname = 'placar';
--   -- executar o texto devolvido

-- ---------------------------------------------------------------------
-- COMO RESTAURAR UM GRANT DE EXECUCAO
-- ---------------------------------------------------------------------
-- Devolver tudo o que o anon executava antes:
--   do $$
--   declare r record;
--   begin
--     for r in select proname, args from _backup_grants_20260824
--              where anon_execute
--     loop
--       execute format('grant execute on function public.%I(%s) to anon',
--                      r.proname, r.args);
--     end loop;
--   end $$;
-- Trocar anon_execute/anon por auth_execute/authenticated para o outro papel.

-- ---------------------------------------------------------------------
-- COMO RESTAURAR UM GRANT DE LEITURA
-- ---------------------------------------------------------------------
--   do $$
--   declare r record;
--   begin
--     for r in select relname from _backup_tabelas_20260824 where anon_select
--     loop
--       execute format('grant select on public.%I to anon', r.relname);
--     end loop;
--   end $$;

-- ---------------------------------------------------------------------
-- COMO CONFERIR QUE VOLTOU AO ESTADO ORIGINAL
-- ---------------------------------------------------------------------
-- Diferenca de grants de funcao entre agora e o congelado:
--   select b.proname, b.args,
--          b.anon_execute as antes,
--          has_function_privilege('anon', (b.proname||'('||b.args||')')::regprocedure, 'execute') as agora
--   from _backup_grants_20260824 b
--   where b.anon_execute is distinct from
--         has_function_privilege('anon', (b.proname||'('||b.args||')')::regprocedure, 'execute');
-- Zero linhas = grants identicos ao congelado.

-- ---------------------------------------------------------------------
-- LIMPEZA (so depois do hardening validado e estavel)
-- ---------------------------------------------------------------------
--   drop table if exists _backup_grants_20260824;
--   drop table if exists _backup_tabelas_20260824;
--   delete from _backup_funcoes where motivo = 'pre-hardening-seguranca-20260824';
