# Correcao de fuso: o placar contava em UTC (31/08/2026)

## O defeito

O banco Supabase roda com `TimeZone = UTC`. As funcoes usavam
`data_conversao::date`, que nesse contexto devolve a data **UTC**, nao a data
local. Toda conversao entre 21h e 23h59 de Brasilia era contada no dia seguinte.

Efeito medido na semana 24 a 30/08/2026, cursos com campanha ativa:

| | antes (UTC) | depois (America/Sao_Paulo) |
|---|---|---|
| Total da semana | 1.810 | **1.835** |
| Customer Experience | 114 | 117 |
| IQNET ISO 45001 Auditor Interno | 54 | 57 |

Nos dois cursos investigados, 44 conversoes da semana mudavam de dia. A correcao
**aumenta** a diferenca contra o CRM, nao diminui.

## O que foi alterado

Backup das definicoes anteriores em `_backup_funcoes_fuso_20260831`.

Quatro objetos tinham o mesmo defeito e foram corrigidos para
`(data_conversao at time zone 'America/Sao_Paulo')::date`:

1. `placar(p_inicio, p_fim)` | a funcao do painel. Corrigido no CTE `leads_novos`,
   o que conserta de uma vez o periodo atual e o periodo anterior (o delta %).
2. `leads_validos` (materialized view) | coluna `dia`. Recriada com os dois
   indices originais (`leads_validos_curso_dia`, `leads_validos_dia`). Nao tinha
   grant para anon/authenticated, nada a restaurar.
3. `midia_por_curso(p_inicio, p_fim)` | CTE `leads_novos`, usada no CPL.
4. `historico_turmas(p_inicio, p_fim)` | lateral que conta lead por turma.

Verificado depois: nenhuma funcao do schema `public` ainda usa
`data_conversao::date`.

## Cuidado para a proxima vez

`insere_conversao` grava `data_conversao` como timestamptz, entao o dado esta
correto na origem. O defeito era so na leitura. Qualquer funcao nova que agrupe
por dia precisa do `at time zone 'America/Sao_Paulo'`, senao reintroduz o bug.

A API do RD Station CRM filtra `created_at` em UTC, mas devolve o timestamp com
offset -03:00. Ao conciliar, cortar pela data do timestamp devolvido (local), nao
pelo filtro da API.
