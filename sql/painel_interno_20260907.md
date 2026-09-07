# Painel interno no padrão Painéis Communitas (07/09/2026)

O visual novo do dashboard do cliente passou a valer também para o que a
Communitas usa por dentro. O interno era a versão MD3 azul de julho/agosto
(`placar.css` + `campanhas.css`), espalhada em quatro endereços com chips de
navegação no topo.

## O que mudou

Nasceu `interno/`, com as mesmas cinco páginas de `dashboard/`: início, placar
de leads, campanhas em andamento, histórico e investimento, campanha
institucional. Sem PIN, com selo **INTERNO** na barra e um bloco **Ferramentas**
no menu apontando para `conversoes.html`, `admin.html` e `reguas.html`.

**Nenhum arquivo foi duplicado.** `interno/*.html` carrega
`../dashboard/dashboard.css`, `../dashboard/shell.js` e a mesma lógica de dados
de sempre. O `shell.js` ganhou um modo, lido de `data-modo` no `<body>`, e
passou a resolver o caminho da logo pelo próprio `src`, que é o que permite a
mesma casca servir as duas pastas.

## O que o interno tem a mais, e a menos

| | interno | cliente |
|---|---|---|
| Trava | nenhuma | PIN 2665 |
| Nita | **não** | sim, injetada depois do PIN |
| Form Pág., Popup e WhatsApp | coluna própria | somados em "Outros" |
| Filtro de campanhas ativas | destravado (`#fAtivas`) | fixo em só ativas |
| Alertas operacionais | seção `#sec-alertas` | não existe |
| Ferramentas de operação | no menu | não existem |

A Nita fica fora por decisão, não por esquecimento: o agente da Tess é o do
cliente, com as travas de "consulta, não consultoria", e consome crédito do
mesmo workspace. A versão interna dela é outro agente, ainda não construído.

## O erro que custou a primeira tentativa

A primeira versão deste painel foi construída sobre `c1e479d`, de 04/09, porque
`git log` local mostrava esse commit como o mais recente. O `origin/main` estava
**quatro commits à frente** — ajustes de layout, o widget da Nita, a correção do
CPL e os ajustes de leitura, empurrados por outra sessão. Sem `git fetch`, nada
disso aparece.

O trabalho foi refeito sobre `8609939`. A versão descartada está em
`git stash` ("painel interno sobre base c1e479d").

**Regra:** `git fetch` antes de ler o repositório, sempre. Está no README.

## Três defeitos corrigidos no caminho

1. **`#alertas` vazava para fora do card.** `repeat(4,1fr)` é
   `minmax(auto,1fr)`: o texto longo do alerta empurrava a grade além da largura
   do conteúdo. Virou `repeat(auto-fit,minmax(240px,1fr))` com `min-width:0`.
   Só aparecia no interno, que é onde os alertas existem.
2. **`.avisodef` quebrava a frase no meio.** Sendo flex, cada trecho de texto ao
   redor de um `<b>` vira item próprio e ganha quebra de linha. Virou `block`.
3. **A barra preta forçava rolagem lateral no celular.** Abaixo de 760px a barra
   media 810px numa tela de 375. Ganhou media query própria.

Os três valem também para o dashboard do cliente, que carrega o mesmo CSS.

## Endereços antigos

`index.html`, `campanhas.html` e `historico-dinamico.html` viraram
redirecionamento para `interno/`; `cliente.html` e `cliente-campanhas.html`,
para `dashboard/`. Cada um mostra uma tela explicando para onde a página foi, no
padrão visual novo, e redireciona em 3 segundos — mesma solução que
`historico.html` já usava desde 24/08.

`placar.css` e `campanhas.css` foram removidos: sem as páginas antigas, ninguém
mais os carregava. Estão no histórico do git se precisarem.

## O que ficou de fora, de propósito

`conversoes.html`, `admin.html` e `reguas.html` continuam com o visual antigo.
Não são relatórios: têm formulário, CRUD com login (Supabase Auth) e, no caso
das réguas, é esboço de julho/2026 com dados congelados. Repelá-las mexe em
campo de formulário e em fluxo de autenticação, e isso não se mistura com troca
de pele.

## Um quarto defeito, achado só depois de publicar

Na verificação no ar, `interno/index.html` abriu **como se fosse a página do
cliente**: pediu PIN, injetou a Nita, não mostrou o selo nem as ferramentas, e
deu 404 em `interno/logo-branco.png`. O arquivo publicado estava correto — o
navegador é que servia o `dashboard/shell.js` antigo, guardado em cache de uma
visita anterior ao painel do cliente. A casca antiga não conhece `data-modo`,
então caía no padrão, que é o modo cliente.

O mesmo cache já tinha me enganado duas vezes no servidor local, e ali era só
ruído de teste. No ar é outra coisa: a falha é silenciosa e entrega a página
errada para quem já usou o dashboard antes.

Correção: os cinco arquivos da casca passaram a ser carregados com
`?v=AAAAMMDD` nas dez páginas. Ao mudar qualquer um deles, subir a data.
