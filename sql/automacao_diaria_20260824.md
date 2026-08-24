# Automação diária da mídia e da view de leads (24/08/2026)

Fecha a pendência 1 e 2 das fases B/C: a carga de mídia deixou de ser manual e
a `leads_validos` deixou de depender de alguém lembrar de atualizar.

Roda inteiro dentro do Supabase. Não depende de nenhuma máquina ligada, nem do
n8n, que era o caminho desenhado antes mas exigiria mais uma peça de
infraestrutura para manter.

## As peças

| Objeto | Papel |
|---|---|
| Edge function `carga-midia-diaria` | lê as 8 abas da planilha (gviz CSV), agrega e chama a RPC |
| `carrega_midia_lote(jsonb, date, date, text)` | grava o lote por upsert, atualiza a view e escreve no log, tudo numa transação |
| `dispara_carga_midia(int, text)` | pega o token no Vault e invoca a function via `pg_net` |
| `carga_token_valido(text)` | confere o token; a function chama esta RPC para se autenticar |
| `midia_carga_log` | histórico de execuções: quantas linhas, quanto tempo, erro |
| 3 jobs no `pg_cron` | `carga-midia-manha`, `carga-midia-tarde`, `refresh-leads-validos` |

## Agenda

pg_cron roda em UTC e o Brasil não tem mais horário de verão, então é sempre UTC-3.

- **06:00 e 18:00 (Brasília)** — carga da mídia, janela de 14 dias
- **de hora em hora, aos :07** — `atualiza_leads_validos()`

Duas cargas por dia porque a planilha nem sempre está atualizada às 6h. Se a da
manhã pegar dado velho, a da tarde conserta no mesmo dia em vez de esperar 24h.

## Por que janela móvel de 14 dias, e não "só o que é novo"

As plataformas **reescrevem os dias recentes** conforme a janela de atribuição
fecha. Carregar só a partir do último `max(data)` congelaria o número errado da
primeira leitura.

Isso não é teoria: no primeiro teste da automação, uma janela de 3 dias trouxe
47 linhas novas e **99 linhas reescritas** nos dias 21 e 22/08, que já estavam
no banco desde a carga manual da manhã.

Por isso a gravação é **upsert** pela chave `midia_diaria_chave`
(data, plataforma, campanha, grupo, conta), e não delete + insert: reprocessar
o mesmo período é idempotente e nunca abre uma janela em que o dado some.

## O que impede a automação de estragar o dado

- **Lote vazio aborta.** Se a planilha cair, sair do ar ou devolver HTML em vez
  de CSV, a RPC levanta exceção e não grava nada. Nunca zera período.
- **Falha em qualquer aba aborta a carga inteira**, para não gravar um período
  só com Meta e deixar Google e LinkedIn com o número velho.
- **Tudo numa transação**: upsert + refresh da view + log. Erro no meio faz
  rollback de tudo.
- **`google_organizacoes` continua fora**, é duplicata exata de `google_mba`.

## Autenticação

A function está com `verify_jwt` desligado, porque quem chama é o pg_cron, que
não tem JWT. No lugar disso ela exige o header `x-carga-token`, conferido
contra um segredo no Vault (`carga_midia_token`).

O token é gerado dentro do banco e nunca sai dele: o `dispara_carga_midia` lê do
Vault na hora da chamada, então ele **não fica escrito na definição do job** em
`cron.job`, que é texto puro. Não é a service_role key: serve só para isso.

Conferido: chamada sem token e com token errado devolvem 401.

## Como acompanhar

```sql
-- últimas execuções
select executado_em, origem, desde, ate, linhas_recebidas, linhas_novas,
       linhas_atualizadas, duracao_ms, status, detalhe
from midia_carga_log order by id desc limit 20;

-- execuções do cron (inclusive as que falharam)
select jobid, runid, status, return_message, start_time
from cron.job_run_details order by start_time desc limit 20;
```

O campo `detalhe` avisa quando aparece **campanha sem curso identificado**: é o
sinal de que alguém precisa cadastrar o padrão em `de_para_campanha`. Sem isso o
gasto existe mas não entra na conta do curso.

## Rodar na mão

```sql
select public.dispara_carga_midia(14, 'manual');   -- janela normal
select public.dispara_carga_midia(120, 'backfill'); -- recarregar 4 meses
```

O teto é 400 dias por chamada.

## Como desligar

```sql
select cron.unschedule('carga-midia-manha');
select cron.unschedule('carga-midia-tarde');
select cron.unschedule('refresh-leads-validos');
```

## O que ficou de fora

- **`atualiza_leads_validos()` usa `refresh materialized view` simples**, que
  segura leitura por uns 3 segundos. Trocar por `concurrently` exigiria criar um
  índice único na view. De hora em hora, 3 segundos não incomoda; se um dia
  incomodar, é aí que se mexe.
- **A verba (campo MKT do Monday) continua manual.** O `sync_campanhas_monday`
  só sincroniza datas. Campanha nova nasce com `verba` null e alguém precisa
  preencher, senão ela aparece sem verba na tela.
- **Fadiga de criativo** (pendência 3 das fases B/C) agora tem base para ser
  construída, já que o incremental existe.
