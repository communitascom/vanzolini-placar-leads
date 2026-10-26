# Sync Monday -> campanhas (26/10/2026)

Sync n8n (PZco4G55OK8okPbG) segue parado. Ultima campanha gravada era de 30/09; 3 ativas.

## Feito

- Backup: tabela `_backup_campanhas_20261026`.
- Upsert direto (sem `sync_campanhas_monday`, que apaga o que nao esta no payload) de 15 itens ATIVA! do board 935301050, com datas (campo PERIODO CAMPANHA) e verba (MKT).
- Mapeamento por nome exato; "IA+ | RH [..]" -> curso 19 e "IA+ | Farmaceutica: Primeiros Passos [..]" -> curso 14 pelo nome entre colchetes.
- Cursos novos confirmados pelo Junior: 132 "Mudancas e Transicao da Norma ISO 9001" (campanha 13238258228, sem verba) e 133 "IA+ | Farmaceutica: qualidade em todo o ciclo de vida" (campanha 13069938326, verba 2925). Sao cursos distintos do 14.
- `atualiza_leads_validos()` rodado. Ativas: 3 -> 13.

## Pendente

- De-para do RD (identificador de conversao) dos cursos 132 e 133. Sem ele, as conversoes ficam orfas.
- Renomear o curso 14 para o nome do Monday: aguardando confirmacao. O nome antigo so aparece em `reguas.html` (snapshot de julho) e em docs, nada depende dele no codigo. O Monday e o banco precisam ficar com o mesmo nome (match exato).
