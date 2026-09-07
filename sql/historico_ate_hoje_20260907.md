# O histórico não parava por falta de dado, parava por um filtro errado

## O diagnóstico anterior estava incompleto

Estava certo que `turmas` congelou em 20/05/2026 e nunca foi realimentada. Estava
errada a conclusão de que faltava dado de junho em diante. **O Monday é a fonte
de data e verba**, e o sync dele já trazia tudo:

| tabela | período | linhas |
|---|---|---|
| `turmas` (planilha, carga de 13/07) | até **20/05/2026** | 149 |
| `campanhas` (sync do Monday) | de **11/05/2026** a 17/10/2026 | 42 |

As duas se encaixam, com nove dias de sobreposição. O dado de junho a outubro
sempre esteve no banco.

## O filtro

`historico_turmas()` unia campanhas ao histórico, mas só de cursos que **nunca**
tiveram turma (CTE `cursos_sem_turma`). Curso com turma antiga **e** campanha
nova ficava com a campanha invisível — que é o caso da maioria, já que os cursos
que mais rodam mídia são justamente os que têm histórico.

Resultado: **28 das 42 campanhas fora do histórico**, R$ 156.525 de verba, de
11/05 a 04/10/2026.

## A correção

A regra passou a ser por **janela**, não por curso: entra toda campanha que não
se sobrepõe a nenhuma turma do mesmo curso. Conferido antes de aplicar:
**nenhuma das 42 campanhas sobrepõe turma existente**, então não há risco de
dupla contagem.

Verificação depois: 191 linhas = 149 de turmas + 42 de campanhas, **zero
duplicatas** por (curso, data_inicio, data_fim).

O histórico agora vai até outubro/2026:

| mês | linhas | leads | previsto | mídia real |
|---|---|---|---|---|
| 2026-06 | 3 | 718 | — | 3.740 |
| 2026-07 | 3 | 1.616 | — | 4.033 |
| 2026-08 | 14 | 7.640 | 127.265 | 95.996 |
| 2026-09 | 20 | 7.833 | 125.540 | 85.009 |
| 2026-10 | 2 | 378 | 7.365 | 894 |

Junho e julho ficam sem investimento previsto porque 8 das 42 campanhas estão
sem `verba` preenchida no Monday. A mídia real vem de `midia_diaria` e está lá.

## O que continua parado, e é outra coisa

`inscritos`, `pagantes` e `receita` seguem só em `turmas`, até 20/05/2026.
**CAC, ROI e conversão continuam congelados** — esses vêm da planilha comercial,
que ainda não apareceu. As campanhas do Monday não têm matrícula.

## O que ficou proposto e não aplicado

`curva_ritmo()` e `cursos.mediana_dia` continuam construídas **só sobre
`turmas`**, ou seja, ainda calibradas com dado que termina em maio. Incluir as
campanhas encerradas do Monday levaria a base de 149 para **174 janelas**,
acrescentando 25 campanhas de jun a set/2026 em 21 cursos.

Não apliquei porque isso muda a régua **Acima/Estável/Abaixo** que o cliente já
viu no placar, e a curva de referência das campanhas. É decisão de produto, não
correção de defeito.
