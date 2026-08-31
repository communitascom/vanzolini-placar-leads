# Reconciliacao 24 a 30/08/2026 (placar x RD Station CRM), nominal por e-mail

## Como foi feito (reprodutivel pela API, sem export manual)

1. `deals_list`, filtro `created_at`, 11 paginas de 200: **1.967 negociacoes**,
   1.921 criadas dentro de 24 a 30/08 em horario local.
2. `contacts_list` por `created_at` (9 paginas) **mais** por `updated_at`
   (11 paginas): 2.166 contatos. **A chave e o `updated_at`**: contato antigo que
   ganha negociacao na semana e atualizado na semana, e so assim ele aparece.
   Com `created_at` sozinho a cobertura era 60,6%; com os dois, 92,3%.
3. Cruzamento por md5 do e-mail (6 chars) contra os leads do placar na mesma
   regra da `placar()` (anti-refire 90d + quarentena de fantasma).

Tabelas de apoio no banco: `_crm_semana_hash` (1.737 e-mails com negociacao) e
`_crm_contato_sem_deal` (409 e-mails que sao contato e nao abriram negociacao).

**Nao usar a tag de curso (`tag-d2bb`) para conciliar.** So 44,9% das
negociacoes tem tag; ela e preenchida adiante no funil, nao na criacao. Por tag
o ONA aparecia com 7 negociacoes; por e-mail tem 190.

## Resultado

| | leads | % |
|---|---|---|
| Placar, 24 a 30/08 | 1.986 | 100 |
| Com negociacao no CRM | 1.675 | **84,3** |
| Viraram contato e nao abriram negociacao | 138 | 6,9 |
| Sem rastro no CRM | 173 | 8,7 |

CRM no mesmo periodo: 1.921 negociacoes criadas (diferenca de volume: 3,4%).

Os 173 "sem rastro" sao **teto**, nao numero fechado: 148 negociacoes (7,7%)
ficaram sem e-mail resolvido porque o contato nao foi criado nem atualizado na
janela consultada.

## Onde esta o vazamento (contato que nao virou negociacao)

Base normal por curso fica entre 0% e 5%. Dois cursos fogem:

| Curso | Leads | Com deal | Contato sem deal | % |
|---|---|---|---|---|
| **IQNET: ISO 45001 - Auditor Interno** | 54 | 26 | **26** | **48,1** |
| **Customer Experience e Gestao da Qualidade** | 114 | 71 | **34** | **29,8** |
| MBA em Lideranca, IA e Execucao | 193 | 158 | 21 | 10,9 |
| Interpretacao ISO 14001 | 124 | 101 | 13 | 10,5 |
| Green Belt (referencia, ja corrigido) | 69 | 63 | 3 | 4,3 |

O Green Belt, que em julho tinha 51 de 161 leads parados em contato
(ver `vanzolini-vazamento-midia-crm` na memoria), hoje esta em 3 de 69. O
problema migrou de curso, nao sumiu.

## Conclusao

O placar nao esta inflado. Em 27 dos 29 cursos com volume, 76% a 94% dos leads
viram negociacao no CRM na mesma semana. As duas excecoes sao problema de
passagem para o comercial, nao de contagem.

## Proximo passo natural

Sincronizar contatos e deals do CRM para o Supabase (por `updated_at`, janela
movel) transforma esta reconciliacao numa query e ela passa a rodar sozinha toda
semana, sem as 20 chamadas de API desta rodada.
