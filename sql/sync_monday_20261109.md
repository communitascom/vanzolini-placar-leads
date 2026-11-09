# Sync Monday -> campanhas (09/11/2026)

Sync n8n segue parado. Comparados os 12 itens ATIVA! do board 935301050 com `campanhas`.

## Feito

- Backup: tabela `_backup_campanhas_20261109`.
- "Do Corredor ao Porto: Vale Investir?" (item 13361269041) fica FORA do placar por decisao do Junior; curso 134 e campanha criados e removidos no mesmo dia.
- MBAs em Engenharia da Qualidade (curso 3, item 12083266337) e Liderança, IA e Execução Estratégica (curso 43, item 12237470208): o Monday ainda marca ATIVA!, mas o periodo de campanha tinha terminado (16/08 e 20/09), entao saiam do placar. `data_fim` estendido para 31/12/2026. Ajustar quando o Monday trouxer o periodo real.

## Pendente

- MBA em IA Aplicada (curso 1) nao esta mais ATIVA! no Monday; mantido como estava.

## Rollback

    update campanhas c set data_fim=b.data_fim from _backup_campanhas_20261109 b where b.id=c.id and c.monday_item_id in ('12083266337','12237470208');
