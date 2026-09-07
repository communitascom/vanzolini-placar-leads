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

---

## Aplicado também: a régua e a curva (07/09/2026, aprovado)

Nasceu a view **`janelas_referencia`** — uma definição só de "janela de
referência", usada pela curva e pela mediana. Antes a regra vivia em dois
lugares, que é exatamente o que fez o histórico divergir do banco em julho.

```sql
turmas (data_fim > data_inicio)
união
campanhas do Monday já encerradas (data_fim < hoje) que não se sobrepõem
a nenhuma turma do mesmo curso
```

### `curva_ritmo()`
Base foi de 140 para **172 turmas** com ao menos 30 leads. Passa a incluir
jun–set/2026.

### `cursos.mediana_dia`
Recalculada sobre a mesma view. **43 dos 56 cursos mudaram**: 30 sobem, 7 descem,
5 ganham régua que não tinham (estavam com `0.00`, que a tela lia como "sem
histórico"). Nenhum perdeu.

Duas correções vieram de brinde em relação ao script de julho:

1. lê `leads_validos` em vez de `conversoes` cru — já com a quarentena dos
   fantasmas (25/08) e o fuso America/Sao_Paulo (31/08);
2. sem o corte `data_fim < 2026-07-01`, que existia para fugir do julho anômalo,
   anomalia que a quarentena resolveu na origem.

Sinal de que ficou certo: **Gerenciamento da Rotina e Ferramentas da Qualidade
foi de 2,0 para 9,0** — e 9,0 é justamente o valor que
`sql/recalcula_mediana.sql` documenta como o correto, dizendo que a base errada
dava 2,0.

Maiores mudanças:

| curso | antes | depois |
|---|---|---|
| Sistema de Gestão Integrado (auditor interno) | 0,0 | 17,0 |
| Interpretação dos Requisitos ISO 14001 | 0,0 | 10,0 |
| Gerenciamento da Rotina e Ferramentas da Qualidade | 2,0 | 9,0 |
| IQNET: ISO 9001 - Auditor Interno | 1,0 | 8,0 |
| Storytelling com Dados e Comunicação Eficaz | 0,0 | 8,0 |
| ONA - Avaliador interno (2026/2029) | 33,5 | 27,0 |
| Liderança Assertiva | 5,0 | 1,0 |

Para reverter: `_backup_mediana_20260907` guarda os valores anteriores.

```sql
update cursos c set mediana_dia = nullif(b.mediana_antiga,0)
from _backup_mediana_20260907 b where b.id = c.id;
```
