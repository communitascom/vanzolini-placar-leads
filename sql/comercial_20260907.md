# CAC, ROI e conversão voltam a existir (07/09/2026)

## Onde estava o dado

Na própria planilha GESTÃO VANZOLINI, na aba **`Comercial_Status`** — eu tinha
lido só a primeira aba e concluído que não estava lá. A planilha tem **13 abas**,
e o export CSV do conector do Drive devolve só a primeira. Para as outras é
preciso exportar como **xlsx**.

`Comercial_Status`: CURSO, SIGLA + TURMA, NOME, DATA INICIO, Status, **Vendas R$**,
R$ (preço), **INSCRITOS**, **CANCELADOS**, **BOLSISTAS**, PRÉ MAT.,
**Matriculas pgtes**, Vendedor. São 508 turmas de jan/25 a jun/27, e está viva:
178 turmas de jun/26 em diante, 122 com pagantes, R$ 2,03 mi em vendas.

Nunca faltou dado comercial. Faltou repetir a carga de 03/08/2026.

## A tabela

`comercial_turma`, chaveada pela **SIGLA + TURMA** (`A-GPMPON T 159`) — que é a
mesma chave do campo `tag-d2bb` dos negócios ganhos no RD Station CRM, o que
permite conferir uma fonte contra a outra.

Substitui a prática de escrever inscritos/pagantes/receita direto em `turmas`:
aqui o dado tem chave própria, data de carga e origem declarada. Carregadas 195
turmas a partir de 01/05/2026 (antes disso o histórico continua vindo de `turmas`).

Recarregar: `scripts/carga_comercial.py`, idempotente pelo `on conflict`.

## A regra de ligação com a campanha

A campanha do Monday é a janela de captação; a turma comercial é a venda que veio
dela. Liga-se a turma do mesmo curso cujo **início cai dentro da janela da
campanha ou até 45 dias depois do fim** — porque a captação roda antes de o curso
começar. Uma campanha pode alimentar mais de uma turma (Green Belt tem três), e
os números são somados.

**32 das 42 campanhas** casam com ao menos uma turma comercial. As que não casam
são turmas vendidas sem mídia paga: entram em receita, não em CAC.

## O resultado

| mês | linhas | com comercial | pagantes | receita | custo | CAC | ROI |
|---|---|---|---|---|---|---|---|
| 2026-05 | 11 | 8 | 100 | 141.307 | 23.165 | 163,61 | 8,64 |
| 2026-06 | 3 | 2 | 30 | 39.040 | 4.465 | 105,33 | 12,35 |
| 2026-07 | 3 | 2 | 29 | 26.251 | 4.977 | 86,23 | 10,50 |
| 2026-08 | 14 | 14 | 188 | 776.203 | 115.052 | 597,99 | 6,75 |
| 2026-09 | 20 | 18 | 200 | 581.405 | 102.310 | 476,43 | 5,95 |
| 2026-10 | 2 | 2 | 3 | 5.538 | 1.107 | 368,96 | 5,00 |

O CAC de agosto é alto porque entram os MBAs, de R$ 12.720 a matrícula. Custo =
mídia real + 13,83% de imposto do Meta + 10% de assessoria, como já era.

## O que fica para a próxima

1. **Carga automática.** Hoje é manual: baixar o xlsx pelo conector do Drive,
   rodar o script, aplicar o SQL. Automatizar exige uma service account do Google
   na edge function, que não existe.
2. **Conferência pelo CRM.** `deals_list` com `status:won` traz `total_price`,
   `closed_at` e o `tag-d2bb` com a mesma sigla. Serve para achar divergência
   entre o que o comercial lançou e o que o CRM registrou, e para acompanhar no
   meio da campanha, já que o CRM é tempo real. Cobertura da tag medida numa
   semana de agosto: 11 de 16 negócios ganhos.
3. **15 turmas sem curso cadastrado** ficaram com `curso_id` nulo e não entram na
   conta por campanha. São cursos novos, a cadastrar quando rodarem mídia.
