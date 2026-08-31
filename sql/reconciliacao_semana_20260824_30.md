# Reconciliacao da semana 24 a 30/08/2026 (placar x RD Station CRM)

## Metodo

Duas tentativas, e a licao e sobre o metodo.

**1. Por tag de curso (`tag-d2bb`): NAO SERVE.** So 863 das 1.921 negociacoes
da semana (44,9%) tem tag. As outras 1.058 entram sem tag, 963 delas com origem
"Desconhecido" e 1.036 como "ongoing". A tag e preenchida adiante no funil, nao
na criacao: entre as ja ganhas ou perdidas quase todas tem tag (30 won e 87 lost
com tag contra 22 lost sem). Comparar por tag faz o placar parecer inflado
quando o lead existe no CRM sem etiqueta.

**2. Por e-mail (nominal): e o metodo certo**, mesmo usado em 25/08 (ver
`fantasma_conversao_20260824.md`, secao "Reconciliacao final dos 3 cursos"),
quando Green Belt bateu 224 x 225, IA na Gestao de Projetos 179 x 177 e
Auditor Lider 200 x 189 decomposto.

## Limite da API (importante para a proxima rodada)

`deals_list` traz `contact_ids`, nao e-mail. Para converter em e-mail e preciso
`contacts_list`, que **nao aceita filtro por id** (`Invalid filter 'id'`). Puxei
os contatos criados de 23 a 30/08 (9 paginas, 1.418 contatos), mas 714 deals da
semana apontam para contato criado antes disso. Resultado: tenho e-mail de 1.164
das 1.921 negociacoes (60,6%), 1.142 e-mails distintos.

**Todo numero de "com deal no CRM" abaixo e, portanto, PISO.**

## Resultado (piso, cobertura de 60,6% do CRM)

Total: 1.986 leads no placar (1.810 em campanha ativa, identico ao painel),
1.921 negociacoes criadas no CRM, diferenca de 3,4% no volume.

| Curso | Leads placar | Com deal (piso) | % |
|---|---|---|---|
| ONA Avaliador interno | 203 | 155 | 76,4 |
| MBA Lideranca, IA e Execucao | 193 | 101 | 52,3 |
| SGI Formacao auditor interno | 127 | 84 | 66,1 |
| Interpretacao ISO 14001 | 124 | 76 | 61,3 |
| Customer Experience | 114 | 45 | 39,5 |
| Inteligencia Emocional | 89 | 52 | 58,4 |
| Basico em Gestao de Projetos | 79 | 47 | 59,5 |
| Green Belt | 69 | 36 | 52,2 |
| Gestao por Resultados | 69 | 32 | 46,4 |
| MBA Engenharia da Qualidade | 67 | 44 | 65,7 |
| IQNET ISO 9001 Auditor Lider | 37 | 30 | 81,1 |
| IQNET ISO 45001 Auditor Interno | 54 | 15 | 27,8 |

Hashes do CRM preservados em `_crm_semana_hash` (md5 de 6 chars) para reproduzir.

## Achados que independem da cobertura

1. **55,1% das negociacoes entram sem curso.** E achado de processo do CRM, nao
   do placar, e e o que impede conferencia rapida.
2. **15 siglas faltam no `de_para_curso_sigla`**, cobrindo ~330 negociacoes da
   semana: SGIFAI (87, confirma o SGI como curso pelo dado do cliente),
   AIR14001ON (72), SGPON (37), IR45001ON (28), IR14001ON (26), MBA-LIEE (21),
   HGPON (16), LACPON (13), AMFMEA (7).
3. Continuam entrando negociacoes de teste no CRM.

## Para fechar de verdade

Precisa do e-mail de todas as negociacoes. Duas saidas: export de deals do CRM
com coluna de e-mail (foi assim em 25/08) ou sincronizar contatos do CRM para o
Supabase e passar a cruzar por la, o que tornaria o teste semanal automatico.
