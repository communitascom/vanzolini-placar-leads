# Fase A: ingestão de mídia paga (25/07/2026)

Traz impressões, cliques, custo e leads de plataforma para o Supabase, a partir
da planilha `Campanhas_Vanzolini_Consolidado`
(`1ViMn-B5fwnL19SfFT74ZJc7r9lWvPJayk5MwoNPgSMQ`). Destrava CTR por plataforma,
CPL vivo e verba gasta versus planejada.

## O que foi criado

| Objeto | Papel |
|---|---|
| `midia_diaria` | 1 linha por data + plataforma + campanha + conta. 20.381 linhas |
| `de_para_campanha` | 28 padrões manuais de campanha para curso |
| `norm_txt(text)` | normaliza para casar nomes (minúsculo, sem acento, sem pontuação) |
| `resolve_curso_campanha(text)` | de-para manual primeiro, depois match automático |
| `midia_por_curso(date, date)` | leitura consolidada, exposta para `anon` |

## Mapa das abas (a nomenclatura engana)

**"todas" NÃO significa todas.** As três abas de cada plataforma são
partições disjuntas, conferido: zero campanhas em comum entre elas.

| Aba | Carregar | conta | Custo conferido |
|---|---|---|---|
| meta_todas | sim | cursos | R$ 297.939 |
| meta_mba | sim | mba | R$ 246.082 |
| meta_organizacoes | sim | organizacoes | R$ 22.146 |
| google_mba | sim | mba | R$ 126.386 |
| google_todas | sim | institucional | R$ 19.166 |
| google_organizacoes | **NÃO** | | duplicata exata de `google_mba` |
| linkedin_todas | sim | cursos | R$ 296.105 |
| linkedin_mba | sim | mba | R$ 41.263 |
| linkedin_organizacoes | sim | organizacoes | R$ 18.420 |

Total: R$ 1.067.507. Os oito valores batem com a planilha na conferência.

`google_organizacoes` é cópia idêntica de `google_mba` (mesmas 14 campanhas,
mesmo custo). Carregar as duas dobraria o Google.

## Armadilhas encontradas

**CTR vem em escalas diferentes por plataforma.** Meta grava em pontos
percentuais (0,784314 = 0,78%), Google e LinkedIn em fração decimal
(0,0149 = 1,49%). Por isso o CTR **nunca é importado**: é sempre calculado
como cliques/impressões na leitura. Vale o mesmo para CPC e CPM.

**`unaccent` traduz símbolo de marca em letra.** "®" virava "r", então
"PMI®" virava "pmi r" e nunca casava com a campanha que escreve "PMI".
Corrigido em `norm_txt`, que remove `®©™℠` antes do unaccent.

**Campanhas usam nome curto.** "Agile Scrum Foundation" na campanha contra
"Agile Scrum Foundation - Preparatório para a certificação EXIN" no catálogo.
Resolvido pelo `de_para_campanha`, não por match parcial, que geraria falso
positivo entre os três cursos de Agile Scrum.

**LinkedIn MBA parou em 05/02/2026.** As outras abas vão até 25/07/2026.

## Cobertura

96,1% do custo (R$ 1.025.473) tem curso identificado. Os 3,9% restantes
(R$ 42.033) são cursos fora do catálogo atual, promocionais multi-curso e
cauda longa. Linha sem curso fica com `curso_id` null e aparece como
"SEM CURSO IDENTIFICADO", nunca é atribuída a um curso por aproximação.

## Validação cruzada

`leads_plataforma` (contado pela própria plataforma) contra `leads` (nossa
contagem no Supabase, regra anti-refire de 90 dias), julho/2026:

| Curso | Plataforma | Plataforma diz | Nós contamos |
|---|---|---|---|
| MBA em IA Aplicada | Meta | 668 | 661 |
| Gerenciamento da Rotina | Meta | 231 | 218 |
| IA Generativa Times Comerciais | Meta | 170 | 152 |

São contagens independentes e ficam a 1% a 10% de distância, o que sustenta
a regra anti-refire por uma fonte externa.

## Carga

A carga inicial foi feita via navegador logado (API gviz da planilha
gravando direto na base por uma função temporária protegida por token, já
removida junto com o grant). **O incremental diário ainda não existe** e
deve ser um workflow n8n com `service_role`, sem exposição pública de
escrita.

## Backups

`_backup_funcoes` ids 17, 18 e 19 (`midia_por_curso`, `norm_txt`,
`resolve_curso_campanha`). Migrações registradas no histórico do Supabase.
