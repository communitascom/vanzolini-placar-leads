# Conversao fantasma e canal por nome (24/08/2026)

Achados da reconciliacao placar x RD Station CRM (01 a 23/08/2026), feita
nominalmente por e-mail com exports de deals do CRM (Green Belt, Auditor
Lider ISO 9001, IA na Gestao de Projetos). Nenhum dado alterado nesta data;
apenas backup (ver `rollback_20260824_pre_correcao_fantasma.sql`).

## Defeito 1: registro fantasma na ingestao

A tabela `conversoes` recebe linhas com o `conversao_rd` de um curso
atribuidas a pessoas que nunca converteram naquele curso (conferido no RD
pelo Junior em 2 casos: o lead nao tem a conversao la).

**Assinatura:** a linha fantasma nasce segundos ou poucos minutos depois de
uma conversao real de OUTRO curso do mesmo e-mail, e o
`origem_raw.nome_campanha` carrega a campanha do curso verdadeiro (ex.:
linha creditada a Green Belt/LinkedIn com payload "Meta | Leads | IQNet:
ISO 45001 - Auditor Interno - T22").

**Caso medido:** `GREEN-BELT-RD` no periodo 01 a 23/08: 16 leads de
LinkedIn no placar, 13 (81,3%) com conversao real de outro curso em ate 10
minutos, 0 com deal no CRM. Base de comparacao (multi-interesse legitimo):
`ISO-9001-AUD-LIDER-RD`, 96 leads, 10,4% na mesma janela. Acima de ~50% e
fantasma, ate ~15% e normal.

**Query de deteccao** (nivel lead, regra dos 90 dias do placar):

```sql
with novos as (
  select c.id, lower(trim(c.email)) as email, c.curso_id, c.canal_id,
         c.conversao_rd, c.data_conversao,
         lag(c.data_conversao) over (partition by c.curso_id, c.email
                                     order by c.data_conversao) as anterior
  from conversoes c where c.curso_id is not null
),
leads as (
  select * from novos
  where (anterior is null or data_conversao - anterior > interval '90 days')
    and data_conversao >= :inicio and data_conversao < :fim
),
marcado as (
  select distinct l.id from leads l
  join conversoes t on lower(trim(t.email)) = l.email
   and t.curso_id <> l.curso_id
   and t.data_conversao between l.data_conversao - interval '10 min'
                            and l.data_conversao + interval '10 min'
)
select l.conversao_rd, count(*) as leads, count(m.id) as suspeitos,
       round(100.0*count(m.id)/count(*),1) as pct
from leads l left join marcado m on m.id = l.id
group by 1 having count(*) >= 10 order by 4 desc;
```

## Defeito 2: canal derivado do texto do nome, payload ignorado

Em agosto/2026: 313 nomes de `conversao_rd` distintos, todos com exatamente
1 canal em 44.822 linhas. Regra aparente: contem `-META` = Meta; termina em
`-RD` = LinkedIn; `Curso - Baixe o Programa` = Form Programatica;
`novo-pop-up*` = Popup; `formulario-curso*` = Form Pagina.

Consequencia: 101 linhas (32 pessoas) gravadas como LinkedIn com payload
dizendo campanha Meta, e 13 no sentido inverso. 81,6% das linhas de agosto
nao trazem `nome_campanha` no payload (canal sem evidencia possivel).

Os dois defeitos se compoem: o nome errado (defeito 1) vira curso E canal
errados de uma vez (defeito 2), e o campo que denunciaria a contradicao e
descartado.

## Estado do backup (este marco)

- `_snapshot_conversoes_20260824` (177.183 linhas) + snapshots de
  `de_para_conversao`, `canais`, `cursos`, `campanhas`, `de_para_campanha`,
  `turmas`, `de_para_curso_sigla`, `lista_placar`. Todos com RLS habilitado
  e sem policy (inacessiveis via anon).
- 42 funcoes `public` em `_backup_funcoes`, motivo
  `marco-pre-correcao-fantasma-20260824...`.
- Tag git: `marco-pre-correcao-fantasma-20260824`.

## Plano acordado (a executar)

1. Auditar o fluxo de ingestao (n8n e/ou funcao `insere_conversao`): casar
   por ID de lead do RD, canal decidido pelo payload quando existir, gravar
   payload completo e marcar contradicao.
2. Quarentena retroativa dos fantasmas (marcar, nunca apagar; `placar()`
   ignora marcados).
3. Reconciliacao recorrente placar x CRM por e-mail, 4 baldes (bate, so
   placar, so CRM, fantasma). Depende do conector RD Station CRM.

Decisoes em aberto do Junior: tolerancia de divergencia (sugerido 5%) e CRM
como regua oficial em caso de divergencia (sugerido sim).
