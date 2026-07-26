# Ponto de virada, 25/07/2026

Estado estável fechado ANTES de comecar a fase de curva de ritmo, previsao de
fechamento de turma e CTR. Tag no repo: `marco-pre-curva-ritmo`.

## O que esta no ar e funcionando

| Pagina | Fonte | Observacao |
|---|---|---|
| `index.html` | Supabase ao vivo, `placar()` | Placar diario, regra anti-refire de 90 dias |
| `historico.html` | `Historico_Leads_Vanzolini.xlsx` (estatico) | Congelado por decisao do Junior, NAO mexer |
| `historico-dinamico.html` | Supabase ao vivo, `historico_mensal()` + `historico_turmas()` | Replica do estatico, mais CPL vs mediana do curso e botao de imprimir/PDF |
| `admin.html` | Supabase (magic link) | CRUD de conversoes |

Publicacao: GitHub Pages a partir de `main`, sem passo de deploy manual.

## Regra de contagem vigente (desde 25/07/2026)

1 lead = 1 conversao de um e-mail num curso **sem outra conversao do mesmo
e-mail no mesmo curso nos 90 dias anteriores**.

Motivo: o webhook do RD reenvia conversoes antigas quando uma automacao ou
lista toca o contato, e o n8n gravava cada reenvio como lead novo. Julho/2026
tinha 73% de refire (contra 5-18% de ruido normal nos outros meses).
Validacao: MBA em Lideranca bateu 44 leads = 44 negocios criados no CRM em
23/07 (a regra anterior mostrava 101).

## Backups deste ponto

- `_backup_funcoes` ids 11 a 16: DDL de `placar`, `historico_mensal`,
  `historico_turmas` (as duas assinaturas), `insere_conversao` e
  `sync_campanhas_monday`, motivo `marco-pre-curva-ritmo`.
- `_backup_placar_snapshot`: numeros de 01 a 25/07/2026 por curso, para
  conferir se algo mudar retroativamente.
- `_backup_mediana`: medianas antigas (contaminadas por refire), antes do
  recalculo.
- Rollbacks anteriores versionados em `sql/`.

## Pendencias abertas nesta data

1. **Investimento por turma para em mai/2026** (vem da planilha). Junior
   indicou que as fontes vivas sao o Monday e a planilha de gestao Vanzolini.
   E pre-requisito para CPL e CAC das campanhas recentes.
2. **CTR nao existe em nenhuma base do projeto.** Nao esta no Supabase nem na
   `Campanhas_Vanzolini_Consolidado` (que tem data, campanha, custo e leads,
   sem impressoes ou cliques). Precisa vir do Reportei ou direto das
   plataformas.
3. **Coluna "Comercial"** (sync diario de deals do CRM): desenhada e simulada
   (87,7% das TAGs resolvem para curso), nao construida.
4. **6 cursos ativos sem turma nem campanha** seguem sem pipeline no
   Historico Dinamico.
