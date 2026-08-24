-- =====================================================================
-- HARDENING DE SEGURANCA | Placar de Leads Vanzolini
-- 24/08/2026 | projeto Supabase ltasijrhkotyyrxnavab
--
-- PRE-REQUISITO: rodar antes o BLOCO 0 de
--   sql/rollback_20260824_pre_hardening_seguranca.sql
--
-- Ordem: BLOCO 1 e o unico urgente. Os demais sao higiene.
-- Cada bloco e independente e reversivel pelo rollback.
-- =====================================================================


-- =====================================================================
-- BLOCO 1 | CRITICO: leads_validos expoe 86.005 e-mails ao anon
-- ---------------------------------------------------------------------
-- Conferido em 24/08/2026 chamando a API REST com a chave anon que esta
-- escrita no index.html publico:
--   GET /rest/v1/leads_validos?select=email  ->  200, e-mails em texto
--   puro, 86.005 linhas, paginaveis. Sem login, sem nada.
--
-- As paginas do placar NAO leem esta view direto: elas chamam RPC. As
-- RPCs sao security definer e rodam como dono, entao continuam lendo a
-- view normalmente depois do revoke.
-- =====================================================================

begin;

  revoke select on public.leads_validos from anon, authenticated;

  -- teste dentro da propria transacao, fingindo ser o anon
  set local role anon;

  -- 1) a leitura direta tem que falhar
  do $$
  begin
    perform 1 from public.leads_validos limit 1;
    raise exception 'FALHOU: anon ainda le leads_validos direto';
  exception
    when insufficient_privilege then
      raise notice 'OK: anon perdeu a leitura direta de leads_validos';
  end $$;

  -- 2) as 7 RPCs do placar tem que continuar de pe
  select count(*) as placar              from placar('2026-08-01','2026-08-24');
  select count(*) as campanhas_andamento from campanhas_andamento();
  select count(*) as ritmo_diario        from ritmo_diario();
  select count(*) as curva_ritmo         from curva_ritmo();
  select count(*) as midia_por_curso     from midia_por_curso('2026-08-01','2026-08-24');
  select count(*) as alertas_captacao    from alertas_captacao();
  select midia_atualizada_ate()          as midia_atualizada_ate;

  reset role;

-- Confira os numeros contra o baseline no arquivo de rollback
-- (79 / 15 / 496 / 21 / 54 / 10 / 2026-08-23; ritmo e curva crescem com
-- o tempo, o que nao pode e virar zero ou dar erro).
-- Bateu -> commit;   qualquer erro -> rollback;
commit;

-- Depois do commit, confirmar pela API de fora:
--   curl -s "$URL/rest/v1/leads_validos?select=email&limit=1" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   esperado: 401 permission denied for materialized view leads_validos


-- =====================================================================
-- BLOCO 2 | Dado comercial em tabela aberta ao anon
-- ---------------------------------------------------------------------
-- turmas    expoe valor, receita, docente, coordenador, inscritos, pagantes
-- campanhas expoe verba
-- Nenhuma das duas e lida por index.html / campanhas.html / cliente.html
-- (essas so chamam RPC). O admin.html le cursos e canais, mas so depois
-- do magic link, ou seja como authenticated, nao como anon.
-- =====================================================================

begin;

  revoke select on public.turmas, public.campanhas from anon;
  -- cursos e canais ficam legiveis pelo authenticated (admin.html)
  revoke select on public.cursos, public.canais    from anon;

  set local role anon;
  select count(*) as placar              from placar('2026-08-01','2026-08-24');
  select count(*) as campanhas_andamento from campanhas_andamento();
  select count(*) as midia_por_curso     from midia_por_curso('2026-08-01','2026-08-24');
  reset role;

commit;

-- Depois: abrir admin.html, entrar pelo magic link e conferir que os
-- selects de curso e canal continuam populando.


-- =====================================================================
-- BLOCO 3 | function_search_path_mutable (33 WARN)
-- ---------------------------------------------------------------------
-- Fixa search_path em toda funcao do public que ainda nao tem. Nao muda
-- assinatura, nao muda corpo, nao mexe em grant. Baixo risco.
-- Pre-requisito real: a funcao referenciar objeto por nome simples que
-- exista em public. Se alguma usar extensao instalada em outro schema
-- (ver BLOCO 6), ela quebra: por isso o teste no fim.
-- =====================================================================

-- 3.1 ver o que sera alterado ANTES de alterar
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and (p.proconfig is null
       or not exists (select 1 from unnest(p.proconfig) c
                      where c like 'search\_path=%'))
order by p.proname;

-- 3.2 aplicar
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (p.proconfig is null
           or not exists (select 1 from unnest(p.proconfig) c
                          where c like 'search\_path=%'))
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
    raise notice 'search_path fixado: %', r.sig;
  end loop;
end $$;

-- 3.3 conferir que o placar nao sentiu
set role anon;
select count(*) from placar('2026-08-01','2026-08-24');
select count(*) from campanhas_andamento();
select count(*) from ritmo_diario();
select count(*) from curva_ritmo();
select count(*) from midia_por_curso('2026-08-01','2026-08-24');
select count(*) from alertas_captacao();
select midia_atualizada_ate();
reset role;

-- 3.4 conferir a carga automatica no proximo ciclo (06:00 / 18:00)
--   select executado_em, status, linhas_recebidas, detalhe
--   from midia_carga_log order by id desc limit 5;


-- =====================================================================
-- BLOCO 4 | ERROR security_definer_view
-- ---------------------------------------------------------------------
-- Uma view do public roda com os privilegios do dono em vez dos de quem
-- chama, entao ela fura RLS para o anon. Achar qual:
-- =====================================================================

select c.relname as view,
       pg_get_userbyid(c.relowner) as dono,
       c.reloptions,
       has_table_privilege('anon', c.oid, 'select') as anon_le
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and (c.reloptions is null
       or not ('security_invoker=true' = any(c.reloptions)))
order by c.relname;

-- Decisao, para CADA view que aparecer acima:
--
--  a) se nenhuma pagina precisa dela pelo anon:
--       revoke select on public.<view> from anon, authenticated;
--
--  b) se alguma pagina precisa e a view so mostra dado agregado que ja
--     e publico no placar: deixar como esta e registrar como intencional
--     neste arquivo, dizendo qual pagina depende.
--
--  c) se precisa e a view toca tabela com RLS:
--       alter view public.<view> set (security_invoker = true);
--     e depois conferir se ainda devolve linha para o anon. Se zerar,
--     e sinal de que ela dependia mesmo de furar a RLS: nesse caso o
--     certo e trocar a view por uma RPC security definer que devolva
--     so o agregado, no mesmo padrao das outras.
--
-- Definicao da view, para decidir:
--   select pg_get_viewdef('public.<view>'::regclass, true);


-- =====================================================================
-- BLOCO 5 | Funcoes de escrita e de infraestrutura executaveis por anon
-- ---------------------------------------------------------------------
-- 29 funcoes security definer executaveis por anon e 29 por authenticated.
-- Sete sao o placar e ficam. O resto precisa de decisao caso a caso.
-- Listar o que existe alem das sete:
-- =====================================================================

select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as sec_definer,
       has_function_privilege('anon',          p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as auth
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not in ('placar','campanhas_andamento','ritmo_diario',
                        'curva_ritmo','midia_por_curso','alertas_captacao',
                        'midia_atualizada_ate')
order by p.proname;

-- Revogar do anon tudo o que escreve ou e infraestrutura. A lista abaixo
-- vem dos nomes chamados pelo admin.html e pela automacao de carga, que
-- nunca rodam como anon. CONFIRA contra o resultado da consulta acima
-- antes de rodar, e comente a linha de qualquer funcao que nao existir.

-- escrita, so pelo admin.html logado (authenticated):
revoke execute on function public.vincula_conversao   from anon;
revoke execute on function public.desvincula_conversao from anon;
revoke execute on function public.cria_curso           from anon;

-- infraestrutura da carga, roda pelo pg_cron, ninguem chama de fora:
revoke execute on function public.carrega_midia_lote   from anon, authenticated;
revoke execute on function public.dispara_carga_midia  from anon, authenticated;
revoke execute on function public.carga_token_valido   from anon, authenticated;
revoke execute on function public.atualiza_leads_validos from anon, authenticated;
revoke execute on function public.sync_campanhas_monday  from anon, authenticated;

-- Depois de cada revoke, abrir a pagina que usa a funcao e conferir.
-- As RPCs de relatorio (historico_*, relatorio_mensal, consolidado_*,
-- evolucao_mensal_ctr, tabela_cursos_canal, de_para_por_curso,
-- google_search_display, campanhas_*, conversoes_orfas) sao leitura e
-- alimentam paginas publicas: decidir uma a uma se a pagina e mesmo
-- publica. conversoes_orfas e de_para_por_curso cheiram a admin.


-- =====================================================================
-- BLOCO 6 | Achados que ficam como estao (registro da decisao)
-- ---------------------------------------------------------------------
-- rls_enabled_no_policy (23 INFO): conferido de fora, essas tabelas
--   devolvem 0 linha para o anon. RLS ligada sem policy nega tudo, que e
--   o estado desejado. Nao criar policy nenhuma so para calar o advisor.
--   As unicas que precisam de policy sao as que o admin.html usa como
--   authenticated (conversoes) e essas ja tem.
--
-- extension_in_public (1 WARN): mover extensao de schema quebra toda
--   referencia nao qualificada, inclusive dentro das funcoes que o
--   BLOCO 3 acabou de amarrar em search_path = public. Custo alto,
--   ganho baixo. Fica. Ver qual e:
--     select extname, extnamespace::regnamespace from pg_extension;
--
-- auth_leaked_password_protection (1 WARN): ligar no painel, em
--   Authentication > Policies. O admin.html entra por magic link e nao
--   usa senha, entao e barato e nao muda nada para o time.
