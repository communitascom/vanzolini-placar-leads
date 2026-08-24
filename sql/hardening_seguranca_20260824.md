# Advisors de segurança do Supabase: o que é intencional e o que é exposição (24/08/2026)

Projeto `ltasijrhkotyyrxnavab`. 118 achados pré-existentes, nenhum vindo da
automação de carga criada hoje (essa já nasceu com `search_path` fixado e
`execute` revogado de anon/authenticated).

## Limitação desta análise

O `mcp__supabase__get_advisors` **não rodou**: o MCP do Supabase não está
conectado nesta sessão (os servidores disponíveis são remotion, perplexity,
reportei e conamore-sql), e a máquina não tem `supabase` CLI nem `psql`. Sem
acesso administrativo não deu para ler `pg_proc`, aplicar mudança nenhuma nem
gravar o snapshot no banco.

O que foi feito no lugar: auditoria **de fora**, batendo na API REST de produção
com a mesma chave anon que está escrita no `index.html` — que é exatamente o que
um estranho tem na mão. Isso não substitui o advisor para classificar as 33
funções sem `search_path`, mas é mais concreto do que ele para responder a
pergunta que importa: **o que o anônimo realmente alcança hoje.**

Achado principal abaixo veio dessa auditoria, não do advisor.

---

## 1. Exposição real, urgente: 86.005 e-mails de leads abertos

```
GET /rest/v1/leads_validos?select=email   →   200, 86.005 linhas
```

A materialized view `leads_validos` tem as colunas `curso_id, email, dia,
canal_id`. O `email` é **texto puro**, e-mail real de lead — a amostra de 200
linhas deu 200 com `@` e 32 domínios distintos (gmail, hotmail, uol, yahoo,
outlook). Zero hash.

Qualquer pessoa que abrir o `index.html`, copiar a chave anon do código-fonte e
paginar o endpoint baixa a base inteira de leads da Vanzolini. É o achado
`materialized_view_in_api`, e ele não é teórico nem intencional: é vazamento de
dado pessoal, com o agravante de ser base de lead, o ativo do cliente.

**Não quebra nada fechar.** As páginas do placar não leem essa view direto — só
chamam RPC, e as RPCs são security definer, rodam como dono e continuam
enxergando a view depois do revoke. É o BLOCO 1 do script de hardening, que já
vem com o teste `set local role anon` dentro da transação.

## 2. Dado comercial em tabela aberta

Também legíveis pelo anon, com linha de verdade:

| objeto | linhas | o que vaza |
|---|---|---|
| `turmas` | 149 | `valor`, `receita`, `docente`, `coordenador`, `inscritos`, `pagantes` |
| `campanhas` | 29 | `verba` |
| `cursos` | 79 | catálogo |
| `canais` | 7 | catálogo |

Nenhuma das quatro é lida por `index.html`, `campanhas.html` ou `cliente.html`.
Só o `admin.html` usa `cursos` e `canais`, e ele entra por magic link, ou seja
como `authenticated`, não como `anon`. Dá para revogar do anon sem tocar em
nada. É o BLOCO 2.

Receita e verba de campanha do cliente abertas na web não são exposição
técnica grave, mas são exposição comercial.

## 3. Intencional, fica como está

**As 7 RPCs do placar.** `placar`, `campanhas_andamento`, `ritmo_diario`,
`curva_ritmo`, `midia_por_curso`, `alertas_captacao`, `midia_atualizada_ate`.
Elas são security definer executáveis por anon de propósito: é assim que um app
estático sem login mostra número agregado sem abrir a tabela crua. Aparecem no
advisor como `anon_security_definer_function_executable`, e o aviso está certo
em existir e errado em ser tratado como defeito aqui. Baseline conferido hoje,
todas 200.

**Os 23 `rls_enabled_no_policy`.** Conferido de fora: `conversoes`,
`midia_diaria`, `investimento_semanal`, `de_para_conversao`, `de_para_campanha`,
`lista_placar` e `midia_carga_log` devolvem **0 linha** para o anon. RLS ligada
sem policy nega tudo — é a defesa funcionando, não um buraco. O advisor marca
INFO porque não sabe se você esqueceu de escrever a policy. Aqui não esqueceu.
Não criar policy nenhuma só para zerar o contador.

**`extension_in_public`.** Mover extensão de schema quebra toda referência não
qualificada, inclusive dentro das funções que o BLOCO 3 amarra em
`search_path = public`. Custo alto, ganho baixo. Fica.

## 4. Higiene, baixo risco

**`function_search_path_mutable` (33 WARN).** Fixar `search_path` não muda
assinatura, corpo nem grant. BLOCO 3 faz em massa, com a consulta do "antes"
separada para você ver o que vai mudar. O único jeito de isso quebrar algo é se
alguma função chamar extensão instalada fora do `public` — por isso o teste das
7 RPCs logo depois, e a conferida no `midia_carga_log` no ciclo seguinte.

**`auth_leaked_password_protection`.** Liga no painel. O `admin.html` entra por
magic link e não usa senha, então é de graça.

## 5. Precisa de decisão sua, não dá para decidir de fora

**O ERROR `security_definer_view`.** Não deu para descobrir qual view é sem
acesso ao catálogo. O BLOCO 4 tem a consulta que acha, e os três caminhos
conforme o caso: revogar se ninguém precisa, registrar como intencional se for
agregado que já é público no placar, ou `security_invoker = true` se ela estiver
furando RLS. Se ao ligar o invoker a view zerar para o anon, é prova de que ela
dependia mesmo de furar a RLS — aí o certo é virar RPC, no padrão das outras.

**As outras 22 funções executáveis por anon.** Das 29, sete são o placar. O resto
inclui coisa que claramente não deveria estar aberta: `vincula_conversao`,
`desvincula_conversao` e `cria_curso` escrevem e só são chamadas pelo
`admin.html` logado; `carrega_midia_lote`, `dispara_carga_midia`,
`carga_token_valido`, `atualiza_leads_validos` e `sync_campanhas_monday` são
infraestrutura chamada pelo pg_cron.

Não testei se o anon consegue de fato executar essas — testar significaria
disparar escrita em produção. O BLOCO 5 tem a consulta que responde isso pelo
catálogo, e os revokes prontos. **Confira a lista contra o resultado da consulta
antes de rodar**, porque os nomes vieram do código do front-end e do doc da
automação, não do banco.

As RPCs de relatório (`historico_*`, `relatorio_mensal`, `consolidado_plataforma`,
`evolucao_mensal_ctr`, `tabela_cursos_canal`, `de_para_por_curso`,
`google_search_display`, `campanhas_*`, `conversoes_orfas`) são leitura e
alimentam páginas. Decidir uma a uma se a página é mesmo pública.
`conversoes_orfas` e `de_para_por_curso` cheiram a admin.

---

## Ordem de execução

1. `sql/rollback_20260824_pre_hardening_seguranca.sql`, BLOCO 0 — congela funções, grants e RLS
2. `sql/hardening_seguranca_20260824.sql`, BLOCO 1 — fecha `leads_validos` (**o urgente**)
3. Abrir `index.html` e `campanhas.html` e conferir na tela
4. BLOCO 2, BLOCO 3 — dado comercial e `search_path`
5. BLOCO 4, BLOCO 5 — rodar as consultas, decidir, revogar
6. Painel: ligar proteção de senha vazada

## O que fica pendente

- Rodar o `get_advisors` de verdade, para pegar os achados que só o catálogo
  mostra e para confirmar a contagem depois do hardening. Precisa conectar o MCP
  do Supabase nesta pasta.
- Depois de fechar a `leads_validos`, avaliar se vale trocar o `email` por hash
  na view. Ela existe para contar lead distinto; o endereço em si provavelmente
  não é necessário ali, e sem ele o estrago de um vazamento futuro é zero.
