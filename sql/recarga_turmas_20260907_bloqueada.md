# A recarga de `turmas` pela planilha não pode ser feita como está (07/09/2026)

Ensaio rodado, **nada foi escrito no banco**. O ponto de retorno
(`marco-ajustes-20260907` + `_backup_turmas_20260907`) segue intacto e não foi
usado, porque não houve o que desfazer.

## O que o ensaio produziu

Filtrando a planilha por STATUS Planejado/Realizado e casando o curso pelo nome
(mais um de-para de 5 variações), sobraram **244 turmas**. Delas, **zero casaram
com as 149 que já existem** no banco pela chave (curso, data_inicio, data_fim).

Inserir seria duplicar a base inteira.

## Por quê: são duas coisas diferentes chamadas de "turma"

| | planilha | tabela `turmas` |
|---|---|---|
| o que a data significa | **quando o curso acontece** | **janela de captação de leads** |
| duração média | variável | 50,1 dias |

O caso do Green Belt deixa isso evidente:

| planilha | banco (curso_id 11) |
|---|---|
| `CCGBON T 100`: 30/10/2025 a 26/02/2026 | turma 71: 10/11/2025 a 19/01/2026 |
| `CCGBON T 101`: 26/01/2026 a (vazio) | turma 72: 20/01/2026 a 07/03/2026 |

Mesma turma, janelas diferentes. E a janela do banco também **não** vem de
`campanhas` (Monday): das 149 turmas, nenhuma bate com uma campanha na chave
(curso, início, fim), e a média lá é de 41,4 dias.

Ou seja: o `data_inicio`/`data_fim` de `turmas` foi derivado de alguma regra na
carga de 13/07/2026 que **não está documentada em lugar nenhum**. O README só
registra que a planilha alimenta `investimento_midia` — e é verdade: é só isso
que ela alimenta.

Isso importa porque é essa janela que define quais leads contam para a turma
(`leads_validos between data_inicio and data_fim`), e portanto a mediana do
curso, a curva de ritmo e o CPL histórico.

## Três defeitos de preenchimento, que valem consertar de qualquer forma

1. **DATA FINAL vazia** em boa parte das linhas. Só no Green Belt: T 95, 96, 97,
   98, 99, 101, 102, 106 e 107 estão sem data final.
2. **STATUS com 10 grafias** ('Planejado', 'planejado', 'REALIZADO', 'reALIZADO',
   'realizado', 'CANCELADA', 'cancelada', 'CANCELADO', 'Descontinuado',
   'a definir') e marcado como REALIZADO em turmas que terminam em dez/2026.
3. **INVESTIMENTO DE MÍDIA com o código da turma digitado junto** do valor
   (`CCGBON T 100 | R$ 5.250,00`), num bloco de linhas em que, além disso, a
   coluna **TEM MÍDIA? ficou vazia**.

## Os três caminhos

1. **Estreito e seguro:** usar a planilha só para atualizar `investimento_midia`
   das turmas que já existem, casando por curso e janela sobreposta. Não cria
   turma nova, então o histórico de jun a set/26 continua vazio.
2. **Descobrir a regra da janela** de captação usada em 13/07 e reproduzi-la.
   Precisa de alguém que saiba como aquela carga foi feita.
3. **Mudar o modelo:** `turmas` passa a ser o calendário do curso (direto da
   planilha) e a janela de captação passa a vir de `campanhas` (Monday), que é
   quem de fato sabe quando a mídia rodou. É o desenho certo, e é redesenho.

## O que a planilha resolve e o que não resolve

Resolve: calendário do curso, valor, e investimento de mídia previsto.
**Não resolve** inscritos, pagantes nem receita — CAC, ROI e conversão continuam
parados em mai/26 até aparecer a planilha comercial.
