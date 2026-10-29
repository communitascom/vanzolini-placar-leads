# Confiabilidade do placar | 29/10/2026

Auditoria cruzada (recálculo próprio + Codex, só leitura) a partir da queixa de que mídia e
leads "ficam instáveis e nunca dá para ter segurança". Seis defeitos se confirmaram e foram
corrigidos no mesmo dia. Rollback das três funções SQL em `rollback_20261029_confiabilidade.sql`.

Migrações aplicadas no Supabase (ficam em `supabase_migrations.schema_migrations`):
`carga_midia_remove_chave_sumida_e_status_real`, `placar_campanha_do_periodo_e_sync_monday_trava`
e `carga_midia_sem_refresh_de_leads`.

## O que estava errado e o que mudou

| # | Defeito | Prova antes | Correção |
|---|---|---|---|
| 1 | Tela inicial somava o institucional duas vezes no KPI "Mídia investida" | 01 a 27/10: R$ 56.344,88 na tela, custo real R$ 45.970,34 | `dashboard/inicio.js` usa só `midia_por_curso` (custo real, já com institucional e sem curso). Institucional = linhas de tipo Institucional da mesma RPC. `institucional_serie` segue só para impressões, cliques, CPM e CPC |
| 2 | Upsert com o nome da campanha na chave, sem apagar: campanha renomeada ficava duas vezes | "Envelhecimento #40" (R$ 465,56 em out) e IQNet SGI Auditor Líder T1 (R$ 1.179,94 de 28/08 a 25/09) | `carrega_midia_lote` remove, dentro da janela, a chave que sumiu da planilha, só nas plataforma+conta que vieram no lote (aba vazia não apaga nada). Antes de apagar copia para `midia_diaria_removida` |
| 3 | `placar()` pegava a campanha mais recente antes de olhar o período | Set/2026: Auditor Interno (241 leads), Auditor Líder, IA Farmacêutica e Liderança apareciam sem campanha ativa | Prefere a campanha que cruza o período; só na falta dela, a mais recente |
| 4 | `sync_campanhas_monday` com lista vazia apagava todas as campanhas do Monday | Lógica `v_ids is null` no delete | Lista vazia aborta. Remoção acima de 5 campanhas ou 20% das do Monday aborta tudo (provável paginação cortada) |
| 5 | Carga gravava "ok" em 134 de 134 execuções | Sem checagem de completude; 28/10 faltando | Status vira `alerta` com campanha sem curso (mostra o valor em R$) ou conta ativa sem dado até D-2. `detalhe` lista os avisos e as remoções |
| 6 | Erro na RPC de mídia aparecia como "sem curso com mídia" e o topo dizia "online" | `placar.js` zerava a mídia em silêncio | Topo diz "mídia indisponível", caixa de erro explica e o CPL fica "sem dado" |

## Achado no caminho: carga encostada no limite

A carga diária levava 6 a 7,8 s com limite de 8 s (`statement_timeout` do authenticator). Quase
todo o tempo era `refresh materialized view leads_validos`, que é view de conversões e não
depende de mídia. Saiu da carga (o cron `refresh-leads-validos` de hora em hora cobre). A carga
de 14 dias caiu para 2,0 s. Janela de 90 dias continua estourando o limite; para reprocessar o
passado, usar janelas de até ~60 dias (62 dias levou 6,0 s).

## Conferência depois da correção

Reprocessado 28/08 a 29/10 (janelas de 30 e 62 dias). Banco contra planilha de origem, chave a
chave (data, plataforma, conta, campanha): 2.354 chaves, **zero divergência acima de 1 centavo**.
Agosto (a partir de 28) R$ 9.335,64, setembro R$ 54.813,50, outubro até 29 R$ 40.427,84, iguais
nos dois lados. O reprocessamento também trouxe 18 linhas que existiam na planilha e faltavam no
banco.

## O que continua aberto

- 27,5% da mídia de outubro sem curso: linha IA+ (Farmacêutica, Operações Industriais, Projetos,
  RH), ISO 9001 Mudanças e episódios [YT]. Precisa cadastrar o de-para (`de_para_campanha` e
  `de_para_conversao`). Enquanto isso a carga fica em `alerta`, de propósito.
- Regra de lead divergente: README diz "1 e-mail por curso no período"; as funções contam
  "nova se a anterior tem mais de 90 dias".
- Sync do Monday segue sem agendamento no Supabase e sem trazer verba.
- PMax fora da extração do Google (planilha certa não garante plataforma certa).
- Selo diário de confiança no topo do painel (proposta no relatório do Codex).
