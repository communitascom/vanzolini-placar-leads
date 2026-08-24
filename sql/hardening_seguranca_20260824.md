# Hardening de segurança do Supabase (24/08/2026) — APLICADO

Projeto `ltasijrhkotyyrxnavab`. O advisor apontava **118 achados**; depois do
hardening são **74**, e nenhum ERROR. As páginas continuam de pé, conferidas na
tela e por chamada direta à API como anon.

Ponto de retorno: tag git `marco-pre-hardening-seguranca-20260824` e as tabelas
`_backup_funcoes` (motivo `pre-hardening-seguranca-20260824`, 41 funções),
`_backup_grants_20260824` (41) e `_backup_tabelas_20260824` (32).
Receitas de restauração em `rollback_20260824_pre_hardening_seguranca.sql`.

## O que estava aberto de verdade

### 1. 86.005 e-mails de lead, em texto puro, para qualquer um

`leads_validos` (materialized view, colunas `curso_id, email, dia, canal_id`)
era legível pelo `anon`. Amostra de 200 linhas: 200 com `@`, 32 domínios reais,
zero hash. Bastava abrir o `index.html`, copiar a chave anon do código-fonte e
paginar `/rest/v1/leads_validos?select=email`.

Matview não aceita RLS, então o que segurava era nada. **Fechado.**

### 2. O anon podia escrever no placar

Seis funções `SECURITY DEFINER` (ou seja, ignoram RLS) executáveis pelo anon:

| função | o que dava para fazer |
|---|---|
| `insere_conversao` | inventar lead e sujar o número que o cliente vê |
| `vincula_conversao` / `desvincula_conversao` | reatribuir lead de curso |
| `cria_curso` | criar curso |
| `sync_campanhas_monday` | sobrescrever dado de campanha |
| `atualiza_leads_validos` | forçar refresh (segura leitura ~3s por chamada) |

Isso não era teoria: no teste de verificação o `cria_curso` respondeu **200** e
criou de fato um curso chamado "teste" (id 81), removido em seguida — `cursos`
voltou a 79 linhas, o mesmo de antes.

**A pegadinha:** revogar de `anon` não resolvia. O Postgres concede `EXECUTE` a
`PUBLIC` por padrão em toda função nova, e o anon herdava daí (`=X/postgres` no
`proacl`). O revoke em `anon` era silenciosamente inócuo. A correção real foi
tirar de `PUBLIC` e passar a depender só dos grants explícitos — mais
`alter default privileges ... revoke execute on functions from public`, para
função nova nascer fechada.

Antes de revogar, conferido nos logs que o `insere_conversao` é chamado pelo n8n
com a chave `sb_secret_…` (service_role), 1.243 vezes em 24h, e nunca pelo anon.
Depois da mudança, 125 chamadas com HTTP 204 na janela seguinte: **ingestão
intacta**. Os únicos 401 foram os testes com a chave anon.

### 3. ERROR `security_definer_view`: `vw_midia_cursos`

View com `SECURITY DEFINER`, legível pelo anon, furando a RLS das tabelas de
baixo. Nenhuma página usa ela nem a RPC irmã `midia_cursos()`. **Fechadas as duas.**

### 4. Dado comercial aberto

`turmas` (valor, receita, docente, coordenador, pagantes), `campanhas` (verba),
`cursos` e `canais` eram legíveis pelo anon. Só o `admin.html` lê essas tabelas
direto, e ele entra por magic link, como `authenticated`. **Revogado do anon.**

Também revogado `insert/update/delete/truncate` do anon em toda tabela do
`public`. Hoje quem segura é a RLS; sem o grant há duas trancas em vez de uma.

## O que era intencional e ficou

**As 22 RPCs de leitura executáveis por anon.** É assim que um site estático sem
login mostra número agregado sem abrir tabela: `placar`, `campanhas_andamento`,
`ritmo_diario`, `curva_ritmo`, `midia_por_curso`, `alertas_captacao`,
`midia_atualizada_ate` e as das outras páginas (`historico_*`, `relatorio_mensal`,
`consolidado_plataforma`, `evolucao_mensal_ctr`, `google_search_display`,
`campanhas_*`, `tabela_cursos_canal`, `conversoes_orfas`, `de_para_por_curso`).
Conferido que `conversoes_orfas` devolve só agregado (nome da conversão,
contagem, datas), sem e-mail.

**Os 23 INFO `rls_enabled_no_policy`.** RLS ligada sem policy nega tudo. É a
defesa funcionando. Conferido de fora: `conversoes`, `midia_diaria`,
`investimento_semanal`, `de_para_*`, `lista_placar`, `midia_carga_log` e os
`_snapshot_*` devolvem 0 linha para o anon. Não criar policy só para calar o
advisor.

**`extension_in_public` (`unaccent`).** Mover quebra referência não qualificada
dentro das funções. Fica — e foi justamente por a `unaccent` estar no `public`
que o `search_path = public, pg_temp` do item abaixo é seguro.

## Higiene aplicada

**33 `function_search_path_mutable` → 0.** `search_path = public, pg_temp` em
toda função do `public`, menos as da extensão `unaccent`. Não mudou assinatura,
corpo nem grant.

## Placar antes e depois (mesma chamada, como anon)

| RPC | antes | depois |
|---|---|---|
| `placar(2026-08-01, 2026-08-24)` | 79 linhas | 79 linhas |
| `campanhas_andamento()` | 15 | 15 |
| `ritmo_diario()` | 496 | 496 |
| `curva_ritmo()` | 21 | 21 |
| `midia_por_curso(...)` | 54 | 54 |
| `alertas_captacao()` | 10 | 10 |
| `midia_atualizada_ate()` | 2026-08-23 | 2026-08-23 |

Na tela: `index.html` com 4.646 leads, 23 campanhas, 79 cursos; `campanhas.html`
com 15 campanhas no ar, R$ 63.284 de verba e a lista de alertas. O
"sem dado" no cartão de investimento do placar é anterior e correto — não há
turma com `data_inicio` na janela de agosto.

## O que sobrou no advisor (74) e por quê

- 22 + 25 `*_security_definer_function_executable` — as RPCs de leitura acima, intencional
- 23 INFO `rls_enabled_no_policy` — RLS negando tudo, intencional
- 1 `extension_in_public` (`unaccent`) — custo alto, ganho baixo
- 1 `auth_leaked_password_protection` — **não dá para ligar neste projeto.**
  Tentado em 24/08/2026 no painel (Authentication > Attack Protection >
  Configure in email provider). O toggle aceita ligar na tela, mas o Save
  devolve: *"Failed to update auth configuration: Configuring leaked password
  protection via HaveIBeenPwned.org is available on Pro Plans and up."* A org
  Communitas está no plano **Free**. Continua DISABLED, nada foi alterado.
  Só sai do advisor com upgrade para Pro, que é decisão de custo, não técnica.
  Impacto real aqui é baixo: o `admin.html` entra por magic link (OTP) e não
  usa senha, então não existe senha de usuário para vazar

## Pendências

1. Proteção de senha vazada: só com upgrade para o plano Pro (ver acima).
   Como o login é por magic link, dá para conviver com esse WARN.
2. Avaliar trocar o `email` da `leads_validos` por hash. A view existe para
   contar lead distinto; o endereço em si provavelmente não é necessário ali, e
   sem ele um vazamento futuro não vale nada.
3. Limpar `_backup_grants_20260824` e `_backup_tabelas_20260824` quando o
   hardening estiver estável.
