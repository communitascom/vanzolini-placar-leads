# Campanhas na versão do cliente + fim do timeout intermitente (24/08/2026)

## O que foi entregue

`cliente-campanhas.html`: a página de campanhas na versão que o cliente acessa
por PIN, **sem a seção "O que pede atenção"**. O `cliente.html` ganhou um chip
para ela e as duas telas compartilham a mesma sessão de PIN, então o cliente
digita o código uma vez só.

Na versão do cliente o alerta **não é nem buscado no banco**: a chamada de
`alertas_captacao()` só entra no lote quando a página tem a seção. O dado não
chega ao navegador dele.

## O aviso de defasagem da mídia continua nas duas versões

O aviso amarelo ("os dados de mídia vão até DD/MM") **não** é um alerta
operacional, é honestidade sobre até quando o número de verba vale. Sem ele,
verba ainda não lançada na planilha parece subinvestimento. Por isso saiu de
dentro da seção de alertas e virou um bloco próprio (`#aviso-midia`), presente
nas duas páginas. Se preferir tirar da versão do cliente, é só remover essa div
do `cliente-campanhas.html`.

## Por que CSS e JS agora são arquivos separados

`campanhas.css` e `campanhas.js` são compartilhados pelas duas páginas.

Isso é resposta direta ao problema do histórico, resolvido hoje mais cedo: uma
cópia congelada da página divergiu do banco por dois meses e ninguém percebeu.
Duplicar a lógica de campanhas plantaria a mesma bomba.

O que muda entre as versões vem do próprio DOM, sem flag espalhada pelo código:

- sem `#sec-alertas` na página → alertas não são buscados nem exibidos
- com `window.AGUARDA_PIN` → o `carregar()` não dispara sozinho, espera o PIN

**Ainda ficou de fora:** `index.html` e `cliente.html` continuam duplicando a
lógica um do outro. Vale o mesmo tratamento quando houver oportunidade.

## O timeout intermitente, resolvido

Durante o teste a página falhou com "Erro ao carregar · canceling statement due
to statement timeout". Mesma classe de problema do histórico, e a causa raiz
vale registrar:

**O papel `anon` tinha `statement_timeout` de 3 segundos**, enquanto o
`authenticated` e o `authenticator` têm 8. Como o placar é um site estático que
lê tudo como `anon`, as análises pesadas rodavam com o limite mais apertado do
projeto inteiro.

As consultas rodam em 0,1s a 0,9s com cache quente, mas a página dispara seis
delas em paralelo; no cache frio, o conjunto passava de 3s. Dependia do estado
do cache, então quebrava "às vezes" — o pior tipo de defeito.

Duas mudanças:

1. **`alter role anon set statement_timeout = '8s'`**. Não é um limite novo: é o
   mesmo valor que o Supabase já usa para `authenticated`. Conferido pela API,
   o anon passou a enxergar 8s.
2. **O cron de hora em hora passou a aquecer o cache.** A nova
   `atualiza_e_aquece_placar()` faz o refresh da `leads_validos` e em seguida
   roda uma vez cada consulta pesada, para o primeiro visitante da hora não
   pagar o custo do cache frio.

## GitHub Pages continua não disparando sozinho

O build automático falhou de novo neste deploy. Antes tinha funcionado uma vez,
então é intermitente, não resolvido. Enquanto durar:

```
gh api -X POST repos/communitascom/vanzolini-placar-leads/pages/builds
```

## Ponto de retorno

Tag `marco-cliente-campanhas-20260824`. Nada foi apagado: `campanhas.html`
manteve exatamente as mesmas seções e a mesma lógica, só passou a carregar o CSS
e o JS de fora.
