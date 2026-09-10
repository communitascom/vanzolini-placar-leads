# Painel de performance de campanha (10/09/2026)

A peça que o cliente aprovou em agosto e setembro (leads acumulados contra
investimento, com meta e projeções) virou tela do painel interno, com filtro e
botão de PDF. O gráfico é o mesmo desenho, portado de Python para JavaScript.

Endereço: `interno/performance.html`. Só interna por enquanto, por decisão de
10/09.

## O obstáculo não era código

O Monday não carrega os dois números que sustentam metade do gráfico. O
`sync_campanhas_monday` grava curso, datas e `monday_item_id`, e nada mais:
**não grava verba nem meta**. A coluna `meta` está nula nas 42 campanhas, e a
`verba` que existe em 31 delas entrou por outro caminho.

Sem meta original e sem a verba do plano não existe CPL do plano, e sem ele não
existe meta ajustada, linha tracejada nem indicador de entrega.

A divisão de fontes, decidida em 10/09:

| Tipo de curso | Verba e meta vêm de |
|---|---|
| MBA | `campanha_plano` (plano de mídia) |
| Curso | `campanhas` (sync do Monday) |

`campanha_plano` é transitória por desenho: some no dia em que o board
padronizar os campos e o sync passar a trazer os dois. **Enquanto isso, curso
comum desenha o gráfico sem linha de meta e sem entrega projetada.**

## As quatro camadas

| Arquivo | O que faz |
|---|---|
| `campanha_plano_20260910.sql` | verba oficial, verba do plano e meta original dos MBAs; CPL do plano e meta ajustada como colunas geradas |
| `midia_custo_real_20260910.sql` | `midia_encargo` mais `vw_midia_custo_real`: 13,83% de imposto na mídia Meta e 10% de assessoria em tudo, por vigência |
| `performance_campanha_20260910.sql` | `performance_campanha` e `performance_campanhas_lista` |
| `dashboard/grafico-campanha.js` | o SVG de 960x540, com viewBox, que serve tela e papel |

## Decisões que valem lembrar

**O custo real não tem condição por tipo de curso.** A regra é por plataforma.
Conferido em 10/09: toda linha de `midia_diaria` tem plataforma preenchida, e a
diferença entre MBA e curso comum é só que curso comum não roda Google.

**A alíquota do encargo tem vigência, a verba não.** Mudar a assessoria para 12%
reescreveria o custo real de julho e um relatório entregue deixaria de bater,
então `midia_encargo` guarda `vigente_desde`. A verba ficou sem histórico por
decisão do Junior, com o argumento de que a revisão aconteceu só nos MBAs e não
é recorrente. O desenho para retomar é o mesmo do encargo.

**A mídia é agregada por dia antes de encontrar os leads.** `midia_diaria` tem
várias linhas por dia (plataforma, conta, campanha, grupo) e `leads_validos` tem
uma contagem por dia. Juntar direto multiplicaria os leads pelo número de linhas
de mídia do dia.

**A fonte da meta é decidida por `cursos.tipo`, nunca por nulidade de
`campanhas.meta`.** Usar `coalesce` funcionaria hoje por acidente e quebraria em
silêncio no dia em que o Monday começasse a preencher.

**Arredondamento uma vez só.** O dia é arredondado a 2 casas e o agregado é a
soma dos dias arredondados, então somar a coluna da tela fecha com o indicador.
Contra a soma crua da view isso dá alguns centavos, o que é preferível a uma
tela que não fecha consigo mesma.

**`p_ini`/`p_fim` recortam período e desligam a projeção; `p_corte` é data de
referência e mantém.** Projetar um pedaço de campanha é extrapolar pedaço.

**Campanha sobreposta é sinalizada, não resolvida.** Mídia e leads são
atribuídos por curso e data, então duas campanhas do mesmo curso com janelas em
comum contam os mesmos dias. Existe um caso real: Interpretação dos Requisitos
ISO 14001, de 03/08 a 04/09 contra 14/08 a 01/09. Escolher a dona do dia é
convenção de negócio, então a RPC devolve `campanha.sobreposta_com` e a tela
avisa para não somar as duas leituras.

## Limite do `p_corte`

Ele reproduz a **mídia** de uma data passada com fidelidade, porque
`midia_diaria` só cresce. Os **leads** seguem o estado atual de `leads_validos`,
que é reprocessada: o Liderança até 23/08 tinha 1.904 leads na leitura daquele
dia e tem 1.915 hoje. Regerar o PDF exato de uma data passada exigiria congelar
os leads também.

## Reprodução conferida

Com `p_corte` em 07/09, contra a peça aprovada do Liderança:

| | RPC | Peça |
|---|---|---|
| CPL real | R$ 26,60 | R$ 26,60 |
| Projeção pela verba | 2.556 | 2.556 |
| Projeção pelo ritmo | 2.636 | 2.636 |
| Dias restantes | 13 | 13 |

O custo real do banco fica dentro de 0,0052% das peças que saíram da planilha
`Campanhas_Vanzolini_Consolidado`. A diferença inteira é do Google, que revisa
cliques inválidos depois do fato; o banco carrega todo dia, então é a fonte mais
nova.

## Três defeitos que a verificação pegou

1. `greatest()` **ignora nulo** em Postgres, então `greatest(null - custo, 0)`
   dava zero e um MBA sem plano aparecia com a verba esgotada, em silêncio.
2. `window.iniciarPainel = function(){ iniciarPainel() }` sobrescrevia o próprio
   binding global, e o wrapper chamava a si mesmo até estourar a pilha. Só
   apareceu no navegador.
3. O widget da Nita estampava no PDF. É um `div` com shadow DOM, sem id nem
   classe, que nenhuma regra de `@media print` alcança, então a página passou a
   poder dispensá-lo com `window.SEM_NITA`. Vale registrar a divergência que
   apareceu no caminho: a documentação do painel interno diz que o interno não
   tem Nita, mas o `shell.js` injeta nos dois modos desde sempre.

## O que segue aberto

1. Verba e meta no board do Monday, e no payload do sync. É o item de maior
   alcance e não depende de código.
2. A regra de desempate para campanhas sobrepostas.
3. Historização da verba, se o PDF for registro e não foto do momento.
4. A página é pública para quem tem o endereço: chave anon, sem PIN no interno,
   e agora ela expõe verba e CPL. A RPC de lista entrega o catálogo inteiro.
