# Leads que não estão entrando no placar (28/08/2026)

Conferência pedida pelo Junior: os cursos com campanha ativa estão com os leads
entrando no placar?

**Resposta: quatro cursos ativos estão com leads praticamente zerados no placar,
apesar de as plataformas reportarem centenas.**

## A causa: conversões órfãs

`conversoes_orfas(30)` mostra identificadores de conversão que chegam do RD mas
**não estão mapeados para curso nenhum** em `de_para_conversao`. Sem curso, a
linha não entra no placar. Nos últimos 30 dias:

| conversao_rd | linhas | pessoas | desde |
|---|---|---|---|
| CURSO - BAIXE O PROGRAMA | 1.240 | 466 | 29/07 |
| SISTEMA-GESTAO-INTEGRADA-RD-META | 1.227 | 406 | 05/08 |
| IQNET-SGI-AUD-LIDER-RD-META | 610 | 174 | 29/07 |
| INT-REQUISITOS-ISO-14001-RD-META | 606 | 140 | 04/08 |
| INTERPRETACAO-REQUISITOS-ISO-45001-RD-META | 562 | 144 | 05/08 |
| ATUALIZACAO-REQUISITOS-ISO-14001-RD-META | 430 | 122 | 16/08 |
| IA-PROJETOS-GESTAO-PORTFOLIO-RD-META | 260 | 96 | 29/07 |
| HARD-SKILLS-PROJETOS-RD-META | 170 | 75 | 08/08 |
| 42001-AUDITOR-INTERNO-IQNET-RD | 29 | 6 | 04/08 |

O padrão é o sufixo **`-RD-META`**: nomes novos, criados no fim de julho, que
nunca foram cadastrados no de-para. Mais de 1.500 pessoas em 30 dias.

## Impacto no placar (agosto, campanhas ativas)

| Curso | Meta diz | Placar Meta | LinkedIn diz | Placar LKD |
|---|---|---|---|---|
| Excelência em Gestão de Operações | 284 | **0** | 245 | **0** |
| IQNET: Sistema de Gestão Integrado - Auditor Líder | 524 | **0** | — | 0 |
| Interpretação dos Requisitos ISO 14001 | 246 | **0** | — | 0 |
| Interpretação dos Requisitos ISO 45001 | 140 | **0** | — | 0 |
| IQNET: ISO 9001 - Auditor Líder | 119 | 129 | 219 | **92** |
| MBA em Engenharia da Qualidade | 673 | 660 | 57 | **2** |

Os outros 14 cursos ativos batem dentro de 10%, que é o esperado.

## Green Belt: a conferência no LinkedIn

No Campaign Manager, `Lkd | Green Belt Lean Seis Sigma - T105` (código 881502933),
30/07–28/08: **11 leads**, R$ 131,98, custo por lead R$ 12,00, 53 cliques.

Nossa base de mídia registrou **2 leads, R$ 193 e 25 cliques** para a mesma
campanha. Os números não fecham em nenhuma direção (gasto maior, cliques e leads
menores), então **a planilha de mídia também tem problema de qualidade nessa
campanha**, além da quarentena.

O placar hoje mostra 5 (depois da liberação dos 4 falsos positivos) e há 13 ainda
em quarentena. Com 11 confirmados pelo LinkedIn, a quarentena claramente marcou
leads reais.

Descoberta útil: **os nomes dos formulários de geração de leads do LinkedIn são
exatamente os `conversao_rd`** (GREEN-BELT-RD, SOFT-SKILLS-PROJETOS-RD, ...).
Dá para reconciliar formulário a formulário.

## Próximos passos

1. Cadastrar os órfãos em `de_para_conversao` (os `-RD-META` são o grosso).
2. Rever a quarentena do Green Belt à luz dos 11 do LinkedIn.
3. Investigar por que a planilha de mídia diverge do LinkedIn na T105.
4. Conferir o lado do CRM (conector RD Station CRM disponível, ainda não usado).
