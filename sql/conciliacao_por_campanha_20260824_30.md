# Conciliacao placar x CRM por campanha de origem (semana 24 a 30/08/2026)

## O metodo que funciona

Comparar **leads do placar** com **negociacoes criadas no CRM no mesmo periodo**,
atribuidas pela **campanha de origem da negociacao** (`campaign_id`).

Por que esse campo e nao a tag de curso (`tag-d2bb`):

| Campo | Cobertura | Quem preenche |
|---|---|---|
| `campaign_id` | 97,7% | integracao RD Marketing -> CRM, na criacao |
| `tag-d2bb` | 44,9% | comercial, depois, no meio do funil |

Pela tag o ONA aparecia com 7 negociacoes; pela campanha de origem, 202.

Como reproduzir: `deals_list` filtrando `created_at` no periodo, agrupar por
`campaign_id`, e `campaigns_list` (3 paginas) para o de-para id -> nome.

## Resultado: 1.810 x 1.673, fecha em 92%

| Curso | Placar | CRM |
|---|---|---|
| ONA Avaliador interno | 203 | 202 |
| MBA Lideranca, IA e Execucao | 193 | 179 |
| SGI Formacao auditor interno | 127 | 121 |
| Interpretacao ISO 14001 | 124 | 113 |
| **Customer Experience** | **114** | **78** |
| Inteligencia Emocional | 89 | 82 |
| Basico em Gestao de Projetos | 79 | 75 |
| Green Belt | 69 | 69 |
| Gestao por Resultados | 69 | 68 |
| IA Farmaceuticas | 64 | 63 |
| IQNET ISO 9001 Auditor Interno | 62 | 59 |
| Agile Scrum PO | 59 | 59 |
| Interpretacao ISO 9001:2015 | 55 | 56 |
| **IQNET ISO 45001 Auditor Interno** | **54** | **28** |
| Soft Skills | 51 | 49 |
| IA na Gestao de Projetos | 50 | 48 |
| Interpretacao ISO 45001 | 48 | 43 |
| Agile Scrum Foundation | 45 | 40 |
| IQNET SGI Auditor Lider | 42 | 37 |
| IQNET ISO 9001 Auditor Lider | 37 | 33 |
| IA Projetos de Melhoria | 36 | 36 |
| Hard Skills | 31 | 29 |
| Upgrade Black Belt | 27 | 27 |
| Lideranca: autoconhecimento | 26 | 24 |
| Atualizacao Manual OPSS ONA | 24 | 22 |
| Yellow Belt | 21 | 22 |
| ISO 45003 | 11 | 11 |
| **Total (27 cursos)** | **1.810** | **1.673** |

Diferenca tipica de 2 a 5 leads: efeito de borda (converte sexta, negociacao
abre na segunda). Seis cursos batem exato.

## Os dois que nao fecharam: falha de integracao em dias especificos

Ambos sao 100% Meta, com um unico identificador de conversao
(`CX-GESTAO-QUALIDADE-RD-META` e `45001-AUDITOR-INTERNO-RD-META`).

**Taxa de leads que viraram negociacao, por dia da conversao:**

| Dia | Customer Experience | IQNET ISO 45001 Aud. Interno |
|---|---|---|
| 24/08 | | 1 de 4 (25%) |
| 25/08 | 5 de 23 (22%) | 0 de 11 (0%) |
| 26/08 | 18 de 26 (69%) | 1 de 9 (11%) |
| 27/08 | 12 de 25 (48%) | 2 de 7 (29%) |
| **28/08** | **11 de 13 (85%)** | **7 de 7 (100%)** |
| **29/08** | **13 de 13 (100%)** | **5 de 6 (83%)** |
| **30/08** | **12 de 14 (86%)** | **10 de 10 (100%)** |

Quebra ate 27/08, normaliza em 28/08. Nos dois cursos, no mesmo dia.

**Hipoteses descartadas com dado:**

1. **Nao e atraso na criacao da negociacao.** Nenhum dos 43 (CX) e 28 (45001)
   ganhou negociacao em 31/08.
2. **Nao e reconversao de contato antigo** (o CRM nao abre negociacao nova para
   quem ja tem uma no mesmo funil). 23 do CX e 17 do 45001 criaram contato NOVO
   na semana e mesmo assim nao abriram negociacao.
3. **Nao e atribuicao errada.** Das negociacoes que existem, 100% estao na
   campanha de origem correta. Nenhuma foi parar em outro curso.
4. **Nao foi falha geral do CRM.** A taxa diaria do conjunto dos 27 cursos ficou
   entre 77% e 91% nos mesmos dias, sem queda equivalente.

O lead chegou ao CRM como contato e a negociacao nao foi criada. Sobra a
automacao de envio para o CRM desses dois formularios entre 24 e 27/08.

## Perda medida

60 leads pagos nesses quatro dias (36 do Customer Experience, 24 do 45001).
