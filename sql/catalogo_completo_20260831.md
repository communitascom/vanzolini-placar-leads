# Catalogo completo + 4 do Monday confirmados (31/08/2026)

Backups: `_snapshot_cursos_20260831`, `_snapshot_de_para_20260831`,
`_backup_curso_id_20260831` (estado de curso_id de todas as 22.538 conversoes
sem curso antes desta rodada).

## 1. Os 4 itens ATIVA! do Monday confirmados pelo Junior (31/08)

| Monday item | Curso | Verba |
|---|---|---|
| 12650265668 | ONA: Avaliador interno (2026/2029), id 49 | 2.685 |
| 12650211375 | Interpretacao dos Requisitos ISO 9001:2015, id 33 | 1.590 |
| 12533191278 | Atualizacao Novo Manual OPSS ONA, id 46 | 1.100 |
| 12708152640 | Interpretacao ISO 14001, id 79 (Atualizacao = mesmo curso, confirmado 28/08 pela URL) | 1.500 |

O curso 79 fica com 2 campanhas simultaneas (Interpretacao ate 04/09 e
Atualizacao ate 01/09); o placar() usa a de data_inicio mais recente.

## 2. Popup dos auditores internos 9001/14001 (achado da conversa do SGI)

91 conversoes recuperadas (78 -> ISO 9001 AI, 13 -> ISO 14001 AI).

## 3. Cadastro em massa: 49 cursos novos (ids 83-130) + 42001 Auditor Lider (131)

Criterio: toda pagina distinta em `origem_raw->>'curso_pagina'` das conversoes
"Curso - Baixe o Programa" sem match no catalogo. Criados com `ativo=false`
(nao aparecem no placar sem lead nem ganham meta; lead deles conta e aparece
quando houver, e a linha entra quando tiver campanha).

Recuperacao em 3 ondas:
- match da pagina pelo nome do curso: 936 linhas (434 de agosto)
- 4 variantes de titulo mapeadas na mao (ONA 2022/2025 e 2026/2029 -> 49,
  "Interpretacao ISO 9001" -> 33, "ISO 45001:2018" -> 78, "IA Farmaceuticas:
  Primeiros Passos" -> 14): 104 linhas
- conversao_rd igual ao nome do curso (28 de-para novos): 1.860 linhas historicas
- 26 identificadores estruturados (LinkedIn/popup/formulario) com canal: 371 linhas

Total da rodada: ~3.362 conversoes ganharam curso. Sem curso em agosto caiu de
5.307 para 4.720 (o grosso do residuo: 312 "Baixe o Programa" sem pagina no
payload + 2.706 sem conversao_rd + eco do CRM).

## Ambiguidade deixada de fora (decidir depois)

Identificadores de Kanban (`KANBAN`, `KANBAN-RD-META-*`, `formulario-curso-kanban`,
`Kanban Foundation`, `novo-pop-up-gestao-de-projetos-kanban-foundation`): o
catalogo tem "Exame Kanban Foundation (PROVA ON-LINE)" e ha um curso "Just In
Time: Kanban, Celulas e Setup Rapido" so como texto de conversao. Nao mapeei
para nao fundir curso com exame.

## Resultado no placar (agosto, apos refresh)

Visao da cliente: 29 -> 32 cursos, 7.753 -> 9.018 leads. Total do mes: 9.362.
