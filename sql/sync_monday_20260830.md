# Sync Monday -> campanhas e unificacao do placar (30/08/2026)

## O problema

O `cliente.html` mostra SOMENTE cursos com campanha ativa. A tabela `campanhas`
nao recebia linha nova desde 07/08/2026 (o sync n8n "Vanzolini - Sync Campanhas
Monday", id PZco4G55OK8okPbG, esta parado desde 13/07 e o de 07/08 fui eu na mao).

Resultado medido em 30/08, periodo 01 a 30/08:

| | antes | depois |
|---|---|---|
| cursos visiveis para a cliente | 23 | 29 |
| leads na visao dela | 7.067 | 7.753 |
| leads fora da visao dela | 1.947 | 1.352 |
| campanhas na tabela | 29 | 38 |
| ativas hoje | 13 | 21 |

## O que foi feito

1. Backup: tabela `_backup_campanhas_20260830` (29 linhas) e tag
   `marco-pre-unificacao-placar-20260830` no repo.
2. Busquei os 31 itens ATIVA! do board 935301050 por GraphQL. Atencao: o filtro
   de status precisa do INDICE do label (`compare_value: [1]`), com o texto
   "ATIVA!" a API devolve lista vazia sem erro.
3. 26 dos 31 casaram com `cursos` por nome. Rodei `sync_campanhas_monday` com
   esses 26 MAIS as 5 campanhas antigas que ja estavam na tabela.
   **A funcao APAGA toda campanha cujo monday_item_id nao esteja no payload.**
   Sem incluir as antigas, MBA em IA Aplicada, Storytelling, Yellow Belt,
   IQNET ISO 9001 Auditor Interno e Gestao por Resultados sumiriam da visao de
   agosto, porque o `placar()` usa a campanha mais recente do curso para decidir
   `campanha_ativa` por sobreposicao com o periodo consultado.
4. `campanhas.verba` preenchida com o campo MKT do Monday (26 itens; MKT igual a
   zero vira null, nao zero).
5. Curso novo "Hard Skills para Gestao de Projetos" (id 82) cadastrado, de-para
   de `HARD-SKILLS-PROJETOS-RD-META` criado e 184 conversoes orfas reprocessadas.
   Campanha do item 12214517421 (06/08 a 17/10, verba 4.680) inserida.
6. `atualiza_leads_validos()` rodado.

## Pendente de confirmacao do Junior (nao mexi)

Quatro itens ATIVA! do Monday nao casam por nome com nenhum curso. Sao parecidos
com cursos existentes, e fundir por semelhanca ja deu errado antes, entao ficaram
de fora ate confirmacao:

| Monday | candidato no banco | leads em agosto |
|---|---|---|
| ONA - Acreditacao ... Formacao de Avaliador interno ... (2026/ 2029) | id 49, "ONA - Acreditacao para organizacoes de saude: Avaliador interno (2026/2029)" | 856 |
| Interpretacao dos Requisitos ISO 9001 | id 33, "Interpretacao dos Requisitos ISO 9001:2015" | 160 |
| Atualizacao Novo Manual OPSS ONA - 2026/2029 | id 46, "Atualizacao Novo Manual OPSS ONA" | 96 |
| Atualizacao da Interpretacao dos requisitos ISO 14001 | id 79 ("Interpretacao dos Requisitos ISO 14001") ou curso novo | a apurar |

Esses 1.112 leads sao a maior parte dos 1.352 que seguem fora da visao dela.

## Unificacao do placar (mesma sessao)

`index.html` e `cliente.html` eram duas copias inteiras do mesmo render (~400
linhas cada). Viraram cascas de 4 e 6 KB sobre `placar.css` e `placar.js`, no
mesmo padrao que `campanhas.html` e `cliente-campanhas.html` ja usavam.

O que muda entre as versoes vem do DOM, sem flag espalhada pelo codigo:

- as colunas saem do `thead` (atributo `data-col`). Canal sem coluna propria e
  somado em "outros", que e como o cliente ve Popup e WhatsApp juntos.
- sem o botao `#fAtivas`, o filtro fica fixo em so campanhas ativas.
- `window.AGUARDA_PIN` segura o `carregar()` ate o PIN.

Conferido no navegador nas duas paginas: mesmos totais (7.768 leads, 29 cursos),
soma dos canais igual ao total nas duas, Popup 31 + WhatsApp 12 + Outros 0 do
interno = Outros 43 do cliente, e o botao de filtro do interno alterna 71 <-> 29
linhas.
