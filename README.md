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
- **`cursos.mediana_dia` (coluna "Esperado"/"Situação") ainda está na régua
  antiga**, calculada por evento. Precisa ser recalculada por pessoa, senão
  os cursos aparecem melhores do que estão.
- **`historico.html` também está na régua antiga** (dados estáticos embutidos),
  então diverge do `index.html` até ser regerado.
- **`admin.html` mostra linhas cruas de propósito**, por ser o painel de
  edição registro a registro. Não deve seguir a regra do placar.

A causa da duplicação em julho **ainda não foi encontrada**. A dedupe na
leitura corrige o número exibido, não a origem: o banco segue recebendo
linhas repetidas. Nenhuma linha foi apagada, o dado bruto está preservado.

## Ponto de restauração

`sql/rollback_20260720_pre_dedupe.sql` restaura as funções ao estado anterior.
Cópia exata também no banco (`_backup_funcoes`) e os números de antes em
`_backup_placar_snapshot`.
