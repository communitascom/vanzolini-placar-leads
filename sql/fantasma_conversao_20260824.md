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

## Causa raiz encontrada e corrigida (24/08/2026, ~17h15 BRT)

Lida a execucao real do n8n (workflow "Leads Vanzolini Placar", id
I5TMKXQFJGFUXf3c) do caso-teste: o RD dispara webhook tambem para eventos
que NAO sao conversao de formulario (ex.: marcacao de oportunidade). Nesses
payloads `last_conversion.content` vem SEM `conversion_identifier`, e o node
"Mapeia Campos do Lead" fazia fallback para
`first_conversion.content.event_identifier`, a PRIMEIRA conversao da vida do
contato (no caso-teste, uma conversao de jan/2024), gravada como lead novo
de hoje. Como as conversoes historicas usam a nomenclatura antiga sem
`-META`, o "Infere Canal" as classificava como LinkedIn.

Correcao aplicada no proprio workflow (backup: duplicata inativa
"Leads Vanzolini Placar (backup pre-correcao 20260824)", id Ra1z4QRFtSqjTA1t):

1. "Mapeia Campos do Lead": `conversao_rd` so de
   `last_conversion.content.conversion_identifier` (sem fallback); novo campo
   `evento_ts` = `last_conversion.created_at`.
2. "Infere Canal": canal decidido primeiro pelo payload
   (`nome_campanha` com prefixo Meta/Lkd), texto do nome como fallback.
3. "Prepara Supabase": descarta item sem conversao (`return []`);
   `p_data_conversao` = `evento_ts` (timestamp real do RD, mata refire via
   `on conflict (email, data_conversao, conversao_rd)` e o bug de fuso);
   `evento_ts` tambem gravado em `p_origem_raw`.

Os ramos de planilha (Google Sheets) nao foram alterados, continuam
recebendo todo evento; apenas o ramo Supabase filtra.

**Publicacao e verificacao (25/08/2026, ~07h40 BRT).** Detalhe operacional:
este n8n versiona e PUBLICA workflows; o PATCH via REST salva rascunho e a
producao continua na versao publicada anterior. Foi preciso publicar pela UI
(versao 3cb33485). Verificado em producao nas 2 primeiras execucoes: conversao
real gravada com `evento_ts` e `data_conversao` no instante real do evento;
evento sem conversao descartado antes do Supabase (execucao 269858, o caso que
gerava fantasma). Linhas gravadas pela versao antiga ate 25/08 10:40 UTC ainda
tem o padrao velho.

## Quarentena retroativa (25/08/2026)

Colunas novas em `conversoes`: `suspeito_fantasma boolean default false` e
`fantasma_motivo text`. Nada apagado; `placar()` passou a ignorar marcados
(migration `placar_ignora_fantasma`; versao anterior em `_backup_funcoes`).

Criterio (validado contra o CRM no caso Green Belt): grupos
(nome-base da conversao, canal, mes) com taxa de co-ocorrencia no nivel de
lead >= 50% (base normal medida: 8 a 15%). Tres faixas:
- pct >= 75% e n >= 5 leads: marca o grupo inteiro;
- pct >= 75% e n >= 2: marca so os leads com co-ocorrencia;
- 50% <= pct < 75% e n >= 5: marca so os leads com co-ocorrencia.
Marcadas as linhas do par (email, curso) do lead ate 90 dias depois (cobre
refire), somente linhas gravadas pela versao antiga (criado_em < 25/08
10:40 UTC). Calculo auditavel em `_quarentena_calculo_20260825`.

Resultado: 1.958 linhas marcadas (413 leads), maio a agosto/2026, nenhum
grupo anomalo antes de maio. Prova no Green Belt 01-23/08: placar caiu de
272 para 254 (LinkedIn 16 -> 0, Outros 2 -> 0, os 18 fantasmas da
reconciliacao), contra 225 deals no CRM; diferenca restante explicada
(7 leads antes da campanha + contatos que nao viram negociacao).

Residuais conhecidos (regra conservadora, nao marcados): nomes com
co-ocorrencia elevada mas abaixo de 50% (ex.: AI-GESTAO-DE-PROJETOS-RD-META-3
com 32,5% em agosto) devem conter fantasmas que so a reconciliacao nominal
com o CRM separa. Funcoes alem da placar() (historico_mensal,
historico_turmas, relatorio_mensal, tabela_cursos_canal) ainda NAO filtram
a quarentena.

Proximas etapas do plano: reconciliacao recorrente placar x CRM (depende do
conector RD Station CRM) e propagar o filtro de quarentena as demais funcoes.
