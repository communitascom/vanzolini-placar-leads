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

---

# FECHAMENTO (28/08/2026): LinkedIn do Green Belt de 1 para 14

## A prova externa

No LinkedIn Campaign Manager, a campanha `Lkd | Green Belt Lean Seis Sigma - T105`
(código 881502933) registra **11 leads** no período 30/07–28/08, R$ 131,98,
custo por lead R$ 12,00. O placar contava 5.

## O teste que separou fantasma de lead real

O bug do webhook copiava a **primeira conversão da vida** do contato. Logo, para
uma linha `GREEN-BELT-RD` ser fantasma, a pessoa precisa ter Green Belt no
passado — sem isso não há o que ressuscitar.

Aplicado aos 13 que restavam em quarentena:

| Perfil | Leads | Conclusão |
|---|---|---|
| Contato **novo** (a conversão de agosto é a primeira da vida) | 6 | impossível ser fantasma |
| Contato antigo, mas **sem Green Belt anterior** | 3 | não havia conversão para ressuscitar |
| **Com Green Belt anterior** | 4 | coerente com fantasma, **permanecem em quarentena** |

Liberados os 9. Resultado: **LinkedIn 1 → 5 → 14**, total do Green Belt em agosto
280 leads.

14 é compatível com os 11 do formulário da T105 mais o LinkedIn institucional,
que em agosto mandou 5.500+ cliques ao site em campanhas sem formulário próprio.

## Por que o critério original errou

A quarentena usou co-ocorrência em 10 minutos com conversão de outro curso, e
marcou **o grupo inteiro** quando o grupo passava de 75%. Co-ocorrência é
circunstancial: duas pessoas podem baixar dois programas na mesma sessão. O teste
do "primeira conversão da vida" ataca o mecanismo do bug em vez do sintoma.

**Lição:** para dado que vai ao cliente, a regra deve marcar só quem tem a
assinatura individualmente; o grupo serve para priorizar a conferência, não para
condenar em bloco.

## Rollback

`_liberados_quarentena_20260828` guarda as linhas originais com o motivo.
