# Histórico: uma versão só, ao vivo (24/08/2026)

O pedido era automatizar a atualização do histórico, uma vez por semana ou por mês.
A conclusão foi outra: **não precisa de job nenhum**. O histórico já podia ser ao
vivo, o que faltava era consertar por que a versão ao vivo falhava.

## O que estava acontecendo

Existiam duas páginas de histórico:

- `historico.html`, com os dados **embutidos no arquivo** (`const DATA = {...}`),
  congelados em **junho/2026** e ainda na régua antiga de contagem, que contava
  linhas do banco em vez de pessoas e por isso inflava os números.
- `historico-dinamico.html`, lendo ao vivo do banco, com **as mesmas 7 seções da
  estática mais uma** (Conversão e CAC por curso).

O `index.html` linkava as duas, e a estática vinha primeiro, com o nome mais
óbvio ("Histórico & investimento"). Ou seja, quem entrava caía no número velho.

Pior: a dinâmica **falhava de forma intermitente**, com "Erro ao carregar ·
canceling statement due to statement timeout". Isso ensinava a equipe a não
confiar nela e voltar para a estática.

## A causa do timeout

`historico_mensal()` e `historico_turmas()` refaziam a regra anti-refire de 90
dias (window function sobre a `conversoes` inteira) a cada chamada. É exatamente
o cálculo que a materialized view `leads_validos` já guarda pronto desde as fases
B/C, e que as outras análises já usavam por esse mesmo motivo.

Aquecidas as funções rodavam em 421 ms e 882 ms, abaixo do teto. No cache frio
estouravam o **timeout de 3 segundos do PostgREST**, e aí a página quebrava. Como
dependia do estado do cache, quebrava "às vezes", que é o pior tipo de defeito:
ninguém consegue reproduzir e todo mundo perde a confiança.

## O que foi feito

As duas funções passaram a ler a `leads_validos` em vez de recalcular.

Conferido **antes** de trocar: o CTE `leads_novos` e a `leads_validos` produzem
exatamente o mesmo conjunto — 11.821 grupos curso+dia, **zero divergência**. A
definição da matview é literalmente o mesmo SQL do CTE.

| Função | Antes | Depois | Linhas |
|---|---|---|---|
| `historico_mensal()` | 421 ms | **80 ms** | 889 (igual) |
| `historico_turmas()` | 882 ms | **216 ms** | 160 (igual) |

E a `historico.html` virou uma página de redirecionamento para a dinâmica,
explicando por que saiu do ar. Os links do `index.html` e do `campanhas.html`
apontam todos para o histórico único agora.

## Por que não precisa de job semanal

A `leads_validos` já é atualizada **de hora em hora** pelo cron criado na
automação de 24/08 (`sql/automacao_diaria_20260824.md`), e a `midia_diaria`, que
alimenta a parte de investimento, carrega **duas vezes por dia**. O histórico
herda as duas cadências sem precisar de nada novo.

Um job semanal ou mensal seria pior que isso: entregaria dado mais velho e
adicionaria mais uma peça para quebrar em silêncio.

## Rollback

`sql/rollback_20260824_pre_historico_rapido.sql` devolve as duas funções ao
cálculo ao vivo. A `historico.html` antiga está no git: `git show
marco-automacao-20260824:historico.html`.

## Sobra em aberto

A coluna `turmas.investimento_midia` vai só até **20/05/2026** (148 turmas), e é
ela que alimenta o Investimento/CPL do placar e do histórico. Diferente da mídia
diária, essa carga continua manual e vem da planilha GESTÃO VANZOLINI. Enquanto
não for automatizada, o CPL por turma envelhece.
