# Dashboard unificado da Vanzolini (04/09/2026)

Reúne num só lugar, com menu, o que estava em quatro endereços: placar de leads,
campanhas em andamento, histórico e investimento, e a campanha institucional (que
vivia no Looker Studio). Fica em `dashboard/`, com PIN e no padrão Painéis
Communitas. As páginas antigas continuam no ar e intactas.

## O que é casca e o que é lógica

O dashboard **não duplica lógica de dados**. Cada página é uma casca sobre o mesmo
JS das páginas antigas, pela regra que já valia entre interno e cliente:

| Página do dashboard | Lógica que ela usa |
|---|---|
| `dashboard/leads.html` | `../placar.js` |
| `dashboard/campanhas.html` | `../campanhas.js` |
| `dashboard/historico.html` | `../historico-dinamico.js` |
| `dashboard/institucional.html` | `dashboard/institucional.js` (novo) |
| `dashboard/index.html` | `dashboard/inicio.js` (novo, só agrega RPCs existentes) |

`dashboard/shell.js` monta barra, menu, trava de PIN e assinatura, e chama
`window.iniciarPainel()` depois do PIN (ou `carregar()`, se a página não definir).
Toda página do dashboard declara `window.AGUARDA_PIN = true`.

O PIN é o mesmo de `cliente.html` (mesma chave de sessão), então quem já entrou
numa não digita de novo na outra. `?pin=NNNN` na URL libera direto, o que serve
para renderizar com Chrome headless.

## O que mudou fora da pasta

1. **`historico-dinamico.js` nasceu**: a lógica do histórico era inline no HTML e
   agora é arquivo, pelo mesmo motivo de `placar.js` e `campanhas.js`. O
   `historico-dinamico.html` só passou a referenciar o arquivo.
2. **Card de CPL médio** (`placar.js`): o número grande agora é o CPL médio
   ponderado (investimento ÷ leads das turmas com mídia), com investimento e
   leads na linha de apoio. Antes o número era o investimento e o CPL vinha
   pequeno. Vale para o placar interno e para o do cliente.
3. **Cores dos gráficos** de `campanhas.js` e `historico-dinamico.js` passaram à
   paleta dos Painéis Communitas (laranja `#E56B39`, azul `#1F6FD0`, verde
   `#0E9E76`). Só constantes de cor mudaram, nenhum cálculo.

## Campanha institucional: as duas fontes

| Vem de | O quê |
|---|---|
| `midia_diaria` (planilha, carga 6h e 18h) | investimento, impressões e cliques por dia, campanha e plataforma |
| `institucional_reportei` (fotos do Reportei) | alcance, frequência, vídeos, anúncios, GA4 e Search Console |

As RPCs novas (`institucional_serie`, `institucional_campanhas`,
`institucional_plano_lista`, `institucional_reportei_lista`) são security definer
e só têm `execute` para `anon` e `authenticated`, como as demais. A gravação
(`institucional_reportei_grava`) fica fora do `anon`.

**Eixo sai do nome da campanha**, por `institucional_eixo()`: "organiza",
"certifica" ou "in company" viram Organizações; "curso" ou "mba" viram Cursos; o
resto é Institucional. `institucional_e_campanha()` decide o que é campanha da
institucional de 2026. Conferido contra o PDF Resumo_Institucional: bate centavo
a centavo (R$ 44.240,08 e 7,77 mi de impressões entre 01/04 e 20/07).

### Alcance: o que dá e o que não dá

- **Meta** informa alcance e frequência por campanha. É a base do alcance por eixo.
- **LinkedIn** informa alcance só por conta. Só entra no consolidado quando a
  conta é praticamente toda institucional no período (share de impressões ≥ 90%),
  senão estaria misturando campanha de captação.
- **Google Ads não informa alcance nem frequência.** O consolidado soma Meta e
  LinkedIn e diz isso no card. Impressões, essas sim, são das três plataformas.
- Se a plataforma não teve veiculação registrada na `midia_diaria` no período, o
  alcance não é exibido mesmo havendo foto: a planilha às vezes está atrás do
  Reportei, e alcance sem investimento confunde mais do que informa.

### Anúncios do Meta não trazem a campanha

O Reportei não filtra anúncios por campanha (testado: `campaign_name IN` devolve
vazio e `campaign IN` devolve a tabela agrupada por campanha). Os anúncios do Meta
foram atribuídos por conta: CERTIFICAÇÃO é Organizações, e na conta CH o nome com
"cursos" vira Cursos. Os do Google têm a campanha na própria tabela, então são
exatos. Conferido em agosto: na conta CERTIFICAÇÃO os anúncios de Link Click e
Thruplays somam exatamente as impressões das campanhas institucionais; na CH
sobram ~2,5% de anúncios de captação com o mesmo tipo de resultado.

## Verba prevista por eixo (`institucional_plano`)

Leitura Communitas do deck `Campanha_Institucional_Vanzolini_2026_v4` (28/08),
pró-rata pelos dias do período: bloco 1 em três eixos de R$ 4.400 em abril e maio,
extensão de R$ 1.600 no Institucional de junho a novembro; bloco 2 (Educação) como
Cursos, R$ 13.300 de junho a agosto e R$ 2.000 de setembro a novembro; bloco 3
(Certificação) como Organizações, R$ 11.300 de agosto a novembro. **A confirmar
com o Junior**: é o único número do painel que não vem de plataforma. Editar a
tabela `institucional_plano` e recarregar resolve, sem tocar em código.

A pílula de ritmo compara percentual da verba consumida com percentual do tempo
decorrido: mais de 20 pontos atrás é "verba atrás do tempo", mais de 15 à frente é
"acima do ritmo".

## Atualização das fotos do Reportei

A carga inicial (abril a 03/09, mês a mês e acumulado, 636 linhas) foi feita em
04/09/2026 pelo MCP do Reportei. A atualização é uma tarefa agendada que refaz o
mês corrente e regrava por upsert, pela mesma RPC. Diferente da carga da mídia,
que roda sozinha dentro do Supabase, esta depende do Reportei e roda pelo app.
