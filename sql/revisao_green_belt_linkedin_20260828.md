# Revisão do Green Belt no LinkedIn (28/08/2026)

## A pergunta

O placar mostrava **1 lead de LinkedIn** para o Green Belt em agosto, e o Junior
apontou que entraram **mais de 15**.

## O que estava acontecendo

A quarentena de fantasmas (25/08) removeu **17 leads de LinkedIn do Green Belt**
em agosto, com o motivo:

`grupo-anomalo GREEN-BELT-RD 2026-08 (76.5% co-ocorrencia, grupo_inteiro)`

A regra `grupo_inteiro` marca **todos** os leads de um grupo quando o grupo passa
de 75% de co-ocorrência. Ou seja, os ~23% restantes foram levados junto sem terem
a assinatura do fantasma. É daí que vem a divergência: 1 no placar + 17 em
quarentena = os 18 que o Junior via.

## Teste lead a lead dos 17

| Evidência | Leads |
|---|---|
| Conversão de outro curso em até **2 min** (assinatura forte) | 10 |
| Conversão de outro curso em até 10 min (sinal fraco) | 3 |
| **Nenhuma co-ocorrência** (marcado só pela regra de grupo) | **4** |

Nenhum dos 17 tem deal no CRM, mas isso sozinho é prova fraca: lead legítimo que
o comercial não trabalhou também não vira deal. E o export do CRM cobria só
01–23/08, então quem entrou depois nem poderia aparecer.

Um dos 4 sem co-ocorrência tem **6 conversões e um único curso na vida inteira**
(Green Belt). Não pode ser fantasma: o mecanismo do bug exige uma conversão de
outro curso para o webhook ressuscitar.

## Ação tomada

Liberados da quarentena os **4 sem co-ocorrência** (e as demais linhas do mesmo
par email+curso). O placar do Green Belt em agosto foi de **LinkedIn 1 → 5**,
total 266 → 270. Linhas originais preservadas em `_liberados_quarentena_20260828`
(com RLS, inacessível pelo anon) para reverter.

Os outros **13 continuam em quarentena**, pendentes de conferência nominal no RD.

## Correção de uma leitura errada minha

Cheguei a tratar os 25 cliques da campanha `Lkd | Green Belt ... T105` como teto
para o número de leads de LinkedIn em agosto. **Está errado.** Em agosto o
LinkedIn institucional mandou mais de 5.500 cliques para o site sem formulário
próprio (Cursos MBA 1.596, Cursos Tráfego 1.400, Geral Tráfego 1.274, In Company
1.264, Intensivão 701). Essas pessoas caem no site e convertem em qualquer curso.

Consequência: a métrica de lead do formulário do LinkedIn (2, na T105) **não é
teto** para leads de canal LinkedIn. Comparar as duas coisas leva a conclusão
errada.

## Pendências

1. **Conferir nominalmente os 13** no RD Station: essas pessoas têm mesmo a
   conversão de Green Belt lá? Se tiverem, a regra `grupo_inteiro` precisa ser
   trocada por `so_co_ocorrentes` também nesse grupo.
2. **O mesmo falso positivo provavelmente atinge outros cursos**, porque a regra
   `grupo_inteiro` foi aplicada a vários grupos. Não consegui quantificar nesta
   sessão: o classificador do modo automático bloqueou as consultas à tabela
   `conversoes` (ela guarda e-mail). Precisa de permissão para seguir.
