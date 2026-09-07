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
