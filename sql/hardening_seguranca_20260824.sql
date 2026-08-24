-- =====================================================================
-- HARDENING DE SEGURANCA | Placar de Leads Vanzolini
-- APLICADO em 24/08/2026 | projeto Supabase ltasijrhkotyyrxnavab
--
-- Registro do que foi rodado, na ordem, como migrations. Analise e
-- resultado em sql/hardening_seguranca_20260824.md
-- Ponto de retorno em sql/rollback_20260824_pre_hardening_seguranca.sql
--
-- Advisor: 118 achados antes, 74 depois, nenhum ERROR.
-- =====================================================================

-- migration: fecha_leitura_publica_leads_validos_e_vw_midia_cursos
revoke all on public.leads_validos   from anon, authenticated;
revoke all on public.vw_midia_cursos from anon, authenticated;
revoke execute on function public.midia_cursos(date, date) from anon, authenticated;

-- migration: tira_do_anon_as_rpcs_de_escrita_e_de_infraestrutura
revoke execute on function public.vincula_conversao(text, bigint)  from anon;
revoke execute on function public.desvincula_conversao(text)       from anon;
revoke execute on function public.cria_curso(text, text)           from anon;
revoke execute on function public.insere_conversao(text, text, timestamptz, text, text, jsonb)
  from anon, authenticated;
revoke execute on function public.atualiza_leads_validos()     from anon, authenticated;
revoke execute on function public.sync_campanhas_monday(jsonb) from anon, authenticated;
revoke execute on function public.midia_diaria_preenche()      from anon, authenticated;

-- migration: tira_do_anon_escrita_em_tabela_e_leitura_de_dado_comercial
do $$
declare r record;
begin
  for r in select c.oid::regclass as t
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r','p')
  loop
    execute format('revoke insert, update, delete, truncate on %s from anon', r.t);
  end loop;
end $$;
revoke select on public.turmas, public.campanhas, public.cursos, public.canais from anon;

-- migration: fixa_search_path_nas_funcoes_do_public
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
             and p.proname not in ('unaccent','unaccent_init','unaccent_lexize')
             and (p.proconfig is null
                  or not exists (select 1 from unnest(p.proconfig) c
                                 where c like 'search\_path=%'))
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- migration: tira_execute_do_public_nas_funcoes_do_schema
-- ESTE e o que realmente fechou a escrita. Sem ele, os revokes em `anon`
-- acima eram inocuos: o anon herdava EXECUTE de PUBLIC (`=X/postgres`).
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
             and p.proname not like 'unaccent%'
  loop
    execute format('revoke execute on function %s from public', r.sig);
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from public;

-- migration: fecha_as_tabelas_de_backup_do_hardening
alter table public._backup_grants_20260824  enable row level security;
alter table public._backup_tabelas_20260824 enable row level security;
revoke all on public._backup_grants_20260824,
                 public._backup_tabelas_20260824 from anon, authenticated;

-- ---------------------------------------------------------------------
-- CONFERENCIA (rodar como anon, de fora, com a chave do index.html)
-- ---------------------------------------------------------------------
-- Tem que devolver 200:
--   rpc/placar, campanhas_andamento, ritmo_diario, curva_ritmo,
--   midia_por_curso, alertas_captacao, midia_atualizada_ate,
--   historico_turmas, historico_mensal, relatorio_mensal, campanhas_totais,
--   campanhas_mes, consolidado_plataforma, evolucao_mensal_ctr,
--   google_search_display, campanhas_exemplo, tabela_cursos_canal,
--   conversoes_orfas, de_para_por_curso
--
-- Tem que devolver 401:
--   rest/v1/leads_validos, vw_midia_cursos, turmas, campanhas, cursos, canais,
--   _backup_*, e rpc/cria_curso, vincula_conversao, desvincula_conversao,
--   insere_conversao, atualiza_leads_validos, sync_campanhas_monday, midia_cursos
--
-- E o n8n tem que continuar gravando:
--   select executado_em from midia_carga_log order by id desc limit 3;
--   e nos logs, insere_conversao com status 204.
