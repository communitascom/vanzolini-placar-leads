# Ajustes de leitura do painel (07/09/2026)

## Indicadores: um card só para as cinco páginas

O padrão de 04/09 (rótulo à esquerda, ícone menor à direita, valor grande, nota
embaixo) valia só no Início e na institucional. Placar, campanhas e histórico
ainda usavam o formato antigo, cada um com um markup diferente — `.lbl/.val`,
`.v/.l/.s` — e o ícone entrava por `::before` + `nth-child` no CSS, o que
obrigava a decorar a ordem dos cards em cada página.

Agora existe **`Dash.kpi(ico, cor, rot, val, nota, pend)`** no `shell.js`, e as
cinco páginas usam ele. Sumiram 32 linhas de CSS de gambiarra e os helpers
duplicados de `inicio.js` e `institucional.js`. Valor que começa com `R$` ganha
o cifrão menor sozinho.

## A cadência real da mídia (e por que o aviso mentia)

O aviso "os dados de mídia vão até DD/MM, N dias atrás" disparava com
`diasAtras > 1`. Medido sobre 20 dias de carga em 07/09/2026:

| | |
|---|---|
| O dado do dia D entra | na carga das **18h do dia D+1** |
| A carga das 6h | nunca traz dia novo, só corrige o que já está lá |
| Atraso normal | **1 dia** depois das 18h, **2 dias** antes |

Ou seja: das 0h às 18h de todo dia, estar dois dias atrás é o desenho
funcionando, não defeito. O aviso disparava metade de todo dia, e alarme falso
ensina a ignorar o aviso. A régua passou a ser dinâmica (`>= 18h ? 1 : 2`), e o
rodapé explica a cadência em vez de deixar o leitor supor.

**A pergunta do Junior, respondida:** sim, o dado é diário e chega sozinho. Não
há o que consertar na frequência — o que havia de errado era o aviso.

## Curva de captação: o pico que não existia

A projeção era desenhada nos bins da curva histórica (`+90% tempo`,
`+95% tempo`), três ou quatro rótulos para representar duas semanas, enquanto o
real vinha dia a dia. O eixo trocava de escala no meio: as linhas de projeção
subiam quase na vertical e viravam um pico visual.

Agora cada dia que falta é um ponto, na mesma régua dos dias corridos, ancorado
no último valor real e fechando no alvo da projeção — sem salto na emenda e sem
pico. A faixa provável virou área sombreada em vez de duas linhas soltas.

## Tempo x verba: lista no lugar do gráfico

Eram barras agrupadas, duas por campanha. A pergunta é "a verba está
acompanhando o tempo **desta** campanha?", que é uma comparação interna, mas
barras lado a lado empurram o olho a comparar campanhas entre si — a leitura
errada.

Virou uma lista: um trilho por campanha, a barra é a verba, o risco vertical é o
tempo, e a distância entre os dois é a resposta, com o selo em pontos
percentuais. Ordenada pelo maior descompasso e com filtro por estado (verba
atrás, no ritmo, à frente, estourada), com a contagem em cada chip.

## Nita no interno

Passou a ser injetada também no modo interno. É o **mesmo agente do cliente**
por enquanto, com as travas de "consulta, não consultoria" e consumindo crédito
do mesmo workspace da Tess. Quando existir a versão interna, o que muda é o
`data-agent-url` dentro de `injetarNita()`.

## Thumbnail de criativo: não dá hoje

`institucional_reportei` guarda só métricas. Conferido campo a campo:

| nível | o que tem de identificação |
|---|---|
| `video` (Google/YouTube) | só o **título** do vídeo, sem id |
| `anuncio` (Meta) | só o **nome** do anúncio ("Ad2", "Meta \| ... - Dark Post") |
| `anuncio` (Google) | `adGroupId~adId`, sem imagem |

Sem id de vídeo do YouTube não dá para montar a URL da thumb
(`i.ytimg.com/vi/<id>/hqdefault.jpg`), e para Meta a imagem do criativo só vem
pela Graph API. Os caminhos possíveis, em ordem de esforço: (1) verificar se a
API do Reportei devolve a URL do criativo e guardar no `m`; (2) puxar direto de
Meta e Google Ads, que é esteira nova; (3) subir as imagens à mão.

---

# Segunda rodada (07/09/2026, tarde)

Ponto de retorno antes desta rodada: tag **`marco-painel-20260907`** (`01e5a19`).

## O gráfico da institucional que saía por cima

`desenhaLinha` montava os passos do eixo com `for (v = 0; v <= max; v += passo)`,
o que para no último múltiplo **abaixo** do máximo, e depois usava esse último
passo como teto do eixo. Com dado de 12 mil e passo de 5 mil, o eixo ia até 10
mil e as linhas de Cursos e Organizações saíam para fora do gráfico. Agora o
topo é `ceil(maxDado / passo) * passo`, sempre acima do maior ponto.

## Projeção: nunca pelo topo

A conta continua a mesma (`curva_ritmo()` dá, por faixa de % de tempo, qual
percentual do total já costuma estar captado; a projeção é `leads ÷ esse
percentual`), mas **o que aparece em destaque mudou**:

| valor | vem de | como aparece agora |
|---|---|---|
| `proj_min` | percentil 75 da curva | **piso provável**, número grande |
| `proj_leads` | mediana | meio da faixa, texto pequeno |
| `proj_max` | percentil 25 | topo da faixa, "cenário, não meta" |

O piso é o número honesto para trabalhar: 3 em cada 4 turmas comparáveis
fecharam dele para cima. A tabela de campanhas também passou a mostrar o piso
na coluna Projeção, e no gráfico a linha grossa é o piso — a mediana ficou como
tracejado fino dentro da faixa sombreada.

A leitura saiu de cima do gráfico e virou uma caixa embaixo, na ordem do mais
certo para o menos certo: captados hoje (fato) → piso → faixa, com o aviso em
negrito de que a projeção muda e depende de verba, concorrência, sazonalidade e
do que acontece fora da campanha.

## Layout, agora igual nas dez páginas

- Saiu o bloco `.cab`: o título já está na barra preta, e repetir embaixo era a
  mesma queixa que valeu para a institucional em 04/09.
- Filtros, "atualizado às HH:MM" e **Salvar PDF** numa linha só, no topo.
- Ordem do placar em todas: **primeiro os cards, depois a caixa branca** com o
  texto ocupando a largura inteira.
- O botão de PDF passou para a casca (`shell.js`); a página que precisa de
  cabeçalho de impressão define `window.imprimirPagina`.
- `Dash.stamp()` carimba a atualização, chamado no fim de cada render.

## Tabelas sem rolagem lateral

**Campanhas no ar**: de 13 para 9 colunas. O período virou segunda linha do
curso, CTR e CPL dividem uma coluna, "Faixa" saiu (vive na caixa da curva) e a
mediana histórica crua saiu — o que informa é a comparação (`vs hist.`), não o
número de referência. Medido: 1.016px de tabela em 1.016px de espaço.

**Placar de leads**: 14 colunas em 1.056px, sem rolagem. Fonte 12px, respiro
menor, coluna do curso em 148–168px, e a data da campanha em 9,5px embaixo do
selo ATIVA.

## Tags de leitura rápida

- Cards de alerta: tag do tipo (**verba** ou **leads**) no topo à esquerda,
  ícone à direita.
- Tempo x verba: tag do estado ao lado do nome do curso, e o traço do tempo
  ganhou 3px e um ponto no topo.

## Duas coisas que continuam impossíveis com o dado de hoje

**Thumb e link do anúncio.** `institucional_reportei` não tem coluna de id nem
de URL, e o `m` guarda só métrica. Google traz `adGroupId~adId` no nome, mas
sem o customer id não dá para montar link; Meta traz só o nome do anúncio;
YouTube, só o título. Vale para a thumb e vale para o link, inclusive no
interno. O conserto é o mesmo nos dois casos: guardar id e URL na carga do
Reportei.

**CTR no histórico.** `historico_turmas()` devolve leads, investimento, CPL,
matrícula, CAC e ROI — não devolve impressões nem cliques. O dado existe em
`midia_diaria`, então é possível, mas exige mexer na RPC que o painel do cliente
também usa.

---

# Terceira rodada (07/09/2026, noite)

## A projeção estava criando expectativa que o histórico não sustenta

O Junior apontou o risco no IQNET: 266 leads captados e o painel exibindo 354
como piso, ou seja, prometendo +88 leads em 18 dias. E a faixa não tinha lado de
baixo — o pior caso já era uma projeção para cima. Faixa que não pode cair não é
faixa, é promessa.

**A âncora deixou de ser o modelo e passou a ser o ritmo observado.**

| número | de onde vem | papel |
|---|---|---|
| Captados até hoje | fato | se a campanha parar agora, é o final |
| **Mantido o ritmo atual** | leads/dia das últimas 2 semanas × dias restantes | **número em destaque** |
| Cenário da curva | mediana de 140 turmas | referência, rotulada "não meta" |

Medido nas 17 campanhas no ar, o ritmo recente fica sistematicamente **abaixo**
da mediana da curva e em geral no nível do antigo "piso" ou abaixo dele:
Customer Experience 656 contra 794, Básico em Gestão de Projetos 398 contra 469,
IQNET ISO 9001 Líder 389 contra 446. É a diferença entre extrapolar o que a
campanha está fazendo e supor que ela vai se comportar como a média das outras.

No gráfico a faixa passou a ir do **pior caso real** (linha reta: a campanha para
hoje) até o cenário da curva, com a linha do ritmo atual em destaque no meio.

## Recém-encerradas (migration `campanhas_andamento_inclui_recem_encerradas`)

`campanhas_andamento()` passou a devolver também o que encerrou nos últimos 7
dias, com as colunas novas `encerrada` e `dias_desde_fim`. Tudo que fala de "no
ar" filtra por `!encerrada`; as encerradas ganharam quadro próprio.

Já na primeira carga apareceu o caso que motivou a mudança: **Interpretação dos
Requisitos ISO 14001 fechou com 159,7% da verba** e tinha sumido da tela no dia
em que encerrou.

## Outros

- **Frequência** virou indicador próprio no bloco de cada eixo, e entrou nas
  tabelas de canais de vídeo e de criativos.
- **Sanfonas**: campanhas do eixo e criativos de vídeo agora recolhem.
- **Setas de variação** nos indicadores do consolidado, contra a janela anterior
  de mesmo tamanho (uma segunda chamada de `institucional_campanhas`). Sem base
  de comparação, sem seta.
- **Rodapé da institucional** enxugado: de onde vem cada número está no doc, não
  na tela. Ficou a data da mídia, a da última foto e a limitação do Google.
- **Topo do histórico**: com cinco filtros, a linha única quebrava e jogava o
  "atualizado" e o PDF para uma segunda linha solta. Nessa página as ações vão
  em cima e os filtros embaixo (`.topo-empilhado`).
- **Favicon** da Vanzolini (símbolo recortado do logo) nas 24 páginas.

## Engajamento no site: o que falta

O card existe e mostra "sem dado" porque a foto do GA4 no `institucional_reportei`
traz só `sessoes` e `sessoes_pagas`. Para preencher, a carga precisa passar a
gravar `sessoes_engajadas` (ou `engajamentos`) e, idealmente, `taxa_engajamento`
e `duracao_media`. É a mesma frente de enriquecer a carga do Reportei que
destrava thumb e link de criativo.
