# Placar de Leads · Vanzolini

App estático (HTML/JS puro, sem build) que lê ao vivo a função `placar()` do
Supabase (projeto `communitas`) e mostra o quadro de leads por curso e canal.

Leitura apenas por enquanto — edição de conversões, turma e investimento
ficam para uma próxima versão, com login (Supabase Auth) no servidor da
Communitas.

Fonte dos dados: aba "Leads limpos" da planilha Placar Leads Vanzolini +
apagão de 16/06–06/07/2026 recuperado do banco painelvanzolini. Carga inicial
feita em 13/07/2026 (ver handoff em `Clientes/Fundação Vanzolini` no vault).

## Regra de contagem de leads (desde 20/07/2026)

**1 lead = 1 e-mail por curso, dentro do período consultado.** A mesma pessoa
que converte várias vezes para o mesmo curso conta uma vez só. O canal
atribuído é o da primeira conversão dela no período, o que garante que as
colunas de canal somem exatamente o total de leads.

Antes de 20/07/2026 o placar contava linhas do banco, não pessoas. Isso
inflava os números: na semana de 13 a 19/07 o Green Belt aparecia com 376
leads quando eram 168 pessoas. O histórico anterior a julho quase não muda
com a regra nova (0,1% a 9,0% por mês), o que confirma que a duplicação é
um fenômeno de julho/2026 e não um viés antigo.

Consequências a ter em mente:

- **Semana não soma mês.** Contagem de pessoas distintas não é aditiva. Quem
  converteu em duas semanas conta 1 em cada semana e 1 no mês.
- **Semana não soma mês** (repetido de propósito, é o engano mais provável).
- **`historico.html` também está na régua antiga** (dados estáticos embutidos),
  então diverge do `index.html` até ser regerado.
- **`admin.html` mostra linhas cruas de propósito**, por ser o painel de
  edição registro a registro. Não deve seguir a regra do placar.

A causa da duplicação em julho **ainda não foi encontrada**. A dedupe na
leitura corrige o número exibido, não a origem: o banco segue recebendo
linhas repetidas. Nenhuma linha foi apagada, o dado bruto está preservado.

## Mediana esperada por curso (`cursos.mediana_dia`)

Recalculada em 20/07/2026 na mesma régua de pessoas. Antes vinha de cópia
manual do `Historico_Leads_Vanzolini.xlsx` e precisava de refresh mensal na
mão. Agora sai do próprio banco.

**Base do cálculo: dias dentro das janelas de campanha**, tiradas da tabela
`turmas` (`data_inicio` a `data_fim`), até 30/06/2026. Julho/2026 fica de fora
de propósito, para não usar o mês anômalo como baseline. Dias de campanha sem
lead entram como zero: campanha parada é zero real e deve puxar a mediana.

O período de campanha é essencial e não é detalhe. A primeira tentativa usou
"dias com pelo menos 1 lead" e deu errado: fora da campanha ainda pinga lead
residual de página antiga e orgânico, e esses dias afundam a mediana, fazendo
todo curso parecer "Acima". A base de turmas reproduz os valores originais da
planilha dentro de 1 a 2 pontos; a base de "dias com lead" errava até 4x
(Gerenciamento da Rotina dava 2,0 onde o correto é 9,0).

Cursos sem turma cadastrada, com menos de 30 dias de campanha, ou com mediana
zero ficam com `null` e a tela mostra "sem histórico", em vez de exibir um
número de base fina que seria ruído.

Achados do recálculo:

- Vários cursos tinham `mediana_dia = 0,00`, não nulo, e por isso apareciam
  como "sem histórico" sem nunca terem tido meta de verdade.
- **23 dos 65 cursos ativos ficaram sem meta por falta de turma cadastrada**,
  e entre eles estão os de maior volume: ONA (898 leads em julho), MBA em
  Liderança IA e Execução Estratégica (886), ISO 31000 (555), IQNET ISO 14001
  (435). As turmas foram importadas da planilha até mai/2026 e os cursos mais
  novos nunca entraram. Cadastrar essas turmas é o que fecha a lacuna.
- Valores originais da planilha preservados em `_backup_mediana`.

Para refazer o cálculo no futuro, a query está em
`sql/recalcula_mediana.sql`.

## O que roda sozinho (desde 24/08/2026)

Três jobs de `pg_cron` no Supabase, sem depender de máquina ligada nem de n8n.
Detalhes em `sql/automacao_diaria_20260824.md`.

| Job | Quando | O que faz |
|---|---|---|
| `carga-midia-manha` | 06:00 (Brasília) | carrega a mídia da planilha, janela de 14 dias |
| `carga-midia-tarde` | 18:00 (Brasília) | idem, para o caso de a planilha ter atualizado depois |
| `refresh-leads-validos` | de hora em hora | atualiza a materialized view `leads_validos` |

Acompanhar por `select * from midia_carga_log order by id desc`. O campo
`detalhe` avisa quando aparece campanha sem curso identificado, que é o sinal de
que falta cadastrar o padrão em `de_para_campanha`.

**O que ainda é manual e envelhece sozinho:**

- `campanhas.verba`, que vem do campo MKT do Monday. O `sync_campanhas_monday`
  só sincroniza datas, então campanha nova nasce sem verba.
- `turmas.investimento_midia`, parado em 20/05/2026. Vem da planilha
  GESTÃO VANZOLINI e alimenta o Investimento/CPL do placar e do histórico.

## Histórico

Só existe uma página de histórico: `historico-dinamico.html`, lida ao vivo.
A `historico.html` virou redirecionamento — era uma cópia estática congelada em
jun/2026 e na régua antiga de contagem. Ver `sql/historico_ao_vivo_20260824.md`.

## Ponto de restauração

`sql/rollback_20260720_pre_dedupe.sql` restaura as funções ao estado anterior.
Cópia exata também no banco (`_backup_funcoes`) e os números de antes em
`_backup_placar_snapshot`.

Marcos posteriores, em ordem: `backup-campanhas-20260824`,
`marco-carga-midia-20260824`, `marco-automacao-20260824`,
`marco-pre-hardening-seguranca-20260824`, `marco-pos-hardening-seguranca-20260824`,
`marco-historico-ao-vivo-20260824`.

## Publicação (GitHub Pages)

Em 24/08/2026 o build automático parou de disparar: o workflow segue ativo, mas
nenhum run é criado nos pushes novos. Se o site não refletir o repositório:

```
gh api -X POST repos/communitascom/vanzolini-placar-leads/pages/builds
gh api repos/communitascom/vanzolini-placar-leads/pages/builds/latest --jq .commit
```
