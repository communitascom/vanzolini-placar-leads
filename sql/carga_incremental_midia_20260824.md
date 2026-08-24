# Carga incremental de mídia + verbas do Monday (24/08/2026)

A `campanhas.html` estava com três defasagens que a faziam parecer quebrada
como controle de investimento. Nenhuma era bug da página: era dado parado.

## O que foi feito

1. **Mídia de 26/07 a 22/08 carregada** em `midia_diaria` (1.542 linhas,
   R$ 120.600). Fonte: as mesmas 8 abas da planilha
   `Campanhas_Vanzolini_Consolidado` (gviz CSV público), agregadas por
   data + plataforma + conta + campanha, igual à carga original. O corte foi
   `data > 2026-07-25`. `google_organizacoes` segue fora (duplicata) e
   `linkedin_mba` segue parada em 05/02 na própria planilha.
   Script: `gera_inserts_midia.py` (gera lotes de INSERT; o trigger
   `trg_midia_diaria_preenche` resolve `curso_id` e `bloco` sozinho).

2. **Verba (campo MKT do Monday) preenchida em 11 campanhas** que estavam
   com `campanhas.verba` null. O `sync_campanhas_monday` não sincroniza a
   verba, só datas — por isso só as 3 campanhas antigas tinham verba.
   Interpretação dos Requisitos ISO 45001 está com MKT = 0 no Monday e ficou
   sem verba de propósito (mas tem R$ 727 gastos — conferir com o time).

3. **Refresh de `leads_validos`** (estava em 20/08, 4 dias atrás). Era isso
   que gerava os alertas falsos de "3 dias úteis zerados": a view congelada
   fazia os dias recentes parecerem sem leads.

4. **3 entradas novas no `de_para_campanha`**: "inteligencia emocional"
   (nome curto → curso 22) e os dois videocasts de YouTube ("yt lideranca na
   era da ia", "lideranca em transformacao" → 42 Institucional). Ficaram como
   SEM CURSO, de propósito: CONARH geolocalização (evento, R$ 1.047) e
   IQNet ISO/IEC 42001 Auditor Interno (curso fora do catálogo, R$ 44).

## Ponto de retorno

Tag `backup-campanhas-20260824`, branch `backup/campanhas-20260824` e
`campanhas.backup-20260824.html`. No banco, nada foi apagado nem alterado
retroativamente: só INSERTs pós-25/07, UPDATEs de `verba` null e o de-para.
Para reverter a carga: `delete from midia_diaria where data > '2026-07-25'`.

## A causa raiz continua aberta

O incremental diário (pendência 1 das fases B/C) segue não existindo. Sem
ele, a mídia volta a envelhecer a partir de hoje. O caminho já desenhado é um
workflow n8n com `service_role` que roda `gera_inserts_midia.py` (ou o
equivalente) + `atualiza_leads_validos()` todo dia.
