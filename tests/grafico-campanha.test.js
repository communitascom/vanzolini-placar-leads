/* Teste de regressão do gráfico de performance de campanha.
   Roda sem navegador e sem rede:  node tests/grafico-campanha.test.js

   Os fixtures são respostas REAIS da RPC performance_campanha, colhidas em
   10/09/2026, com a série cortada em 3 dias (o desenho não depende do tamanho).
   Existe porque a quebra mais provável deste conjunto é silenciosa: a RPC muda
   um campo, o gráfico cai no fallback e o PDF continua saindo bonito e errado. */
const assert = require('assert');
const path = require('path');

// shim mínimo: o gerador só precisa de um host com innerHTML e de window
global.window = { console: console };
global.document = {};
require(path.join(__dirname, '..', 'dashboard', 'grafico-campanha.js'));
const Grafico = global.window.GraficoCampanha;

const F = require(path.join(__dirname, 'fixtures-performance.json'));

function desenhar(dados) {
  const host = { innerHTML: '' };
  Grafico.desenha(host, dados);
  return host.innerHTML;
}
function texto(svg) {
  return svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

let passou = 0, falhou = 0;
function t(nome, fn) {
  try { fn(); passou++; console.log('  ok   ' + nome); }
  catch (e) { falhou++; console.log('  FALHA ' + nome + '\n        ' + e.message); }
}

console.log('\ncampanha vigente, janela inteira');
{
  const svg = desenhar(F.vigente_inteira), tx = texto(svg);
  t('indicador é entrega projetada', () => assert.ok(tx.includes('ENTREGA PROJETADA')));
  t('mostra a faixa das duas projeções', () => assert.ok(tx.includes('2.556 a 2.637')));
  t('subtítulo fala da campanha, não de recorte', () => {
    assert.ok(tx.includes('campanha de 25/06 a 20/09/2026'));
    assert.ok(!tx.includes('recorte dentro da campanha'));
  });
  t('marca do eixo diz a data da carga, não "hoje", quando o corte não é hoje', () => {
    assert.ok(tx.includes('dados até 08/09'), 'esperava "dados até 08/09"');
    assert.ok(!/\bhoje\b/.test(tx), 'não podia dizer "hoje" com corte em 08/09 e hoje em 10/09');
  });
  t('linha de meta presente', () => assert.ok(tx.includes('Meta ajustada 2.876')));
  t('leitura cita o CPL do plano', () => assert.ok(tx.includes('R$ 26,60') && tx.includes('R$ 23,64')));
  t('curso sem turma fechada ganha tag, não régua inventada', () => {
    assert.ok(tx.includes('sem histórico'), 'esperava a tag');
    assert.ok(tx.includes('primeira turma do curso'));
    assert.ok(!tx.includes('mediana do curso'), 'não podia desenhar mediana sem histórico');
  });
}

console.log('\nrecorte de mês dentro de campanha em andamento');
{
  const svg = desenhar(F.recorte_mes), tx = texto(svg);
  t('não afirma resultado de campanha', () => {
    assert.ok(!tx.includes('A campanha gastou'), 'não pode falar em nome da campanha inteira');
    assert.ok(!tx.includes('curva fechada'));
  });
  t('subtítulo avisa que é recorte', () => assert.ok(tx.includes('recorte dentro da campanha')));
  t('nota do painel avisa que não é a campanha inteira', () =>
    assert.ok(tx.includes('não é a campanha inteira')));
  t('indicador vira captado até aqui, no período', () => {
    assert.ok(tx.includes('CAPTADO ATÉ AQUI'));
    assert.ok(tx.includes('no período selecionado'));
  });
  t('sem projeção desenhada', () => assert.ok(!tx.includes('gastando a verba toda')));
}

console.log('\ncampanha encerrada');
{
  const svg = desenhar(F.encerrada), tx = texto(svg);
  t('indicador é entrega realizada', () => assert.ok(tx.includes('ENTREGA REALIZADA')));
  t('nota diz que a curva fechou', () => assert.ok(tx.includes('curva fechada')));
  t('curso com histórico desenha a mediana e diz a base', () => {
    assert.ok(tx.includes('mediana do curso 12'), 'esperava a mediana de 12/dia');
    assert.ok(tx.includes('base de 3 turmas'));
  });
  t('leitura fala no passado', () => assert.ok(tx.includes('fechou em') && tx.includes('A campanha gastou')));
  t('sem projeção', () => assert.ok(!tx.includes('gastando a verba toda')));
}

console.log('\ncontrato e bordas');
{
  t('resposta de erro não desenha gráfico', () => {
    const host = { innerHTML: '' };
    Grafico.desenha(host, { erro: 'a campanha ainda nao comecou', codigo: 'CAMPANHA_FUTURA' });
    assert.ok(host.innerHTML.includes('ainda nao comecou'));
    assert.ok(!host.innerHTML.includes('<svg'));
  });
  t('resposta fora do contrato não desenha gráfico', () => {
    const host = { innerHTML: '' };
    Grafico.desenha(host, { campanha: {}, plano: {} });
    assert.ok(host.innerHTML.includes('formato inesperado'));
  });
  t('série sem leads_acumulados avisa no console em vez de mentir calado', () => {
    const semAcum = JSON.parse(JSON.stringify(F.vigente_inteira));
    semAcum.serie.forEach(r => delete r.leads_acumulados);
    let avisou = false;
    const orig = console.warn;
    global.window.console = { warn: () => { avisou = true; } };
    desenhar(semAcum);
    global.window.console = console;
    console.warn = orig;
    assert.ok(avisou, 'devia avisar que a RPC mudou de contrato');
  });
  t('aspas no nome do curso não escapam do atributo', () => {
    const comAspas = JSON.parse(JSON.stringify(F.vigente_inteira));
    comAspas.campanha.curso = 'MBA "aspas" e <tag>';
    const svg = desenhar(comAspas);
    assert.ok(!svg.includes('MBA "aspas"'), 'aspas cruas dentro do SVG');
    assert.ok(svg.includes('&quot;') && svg.includes('&lt;tag&gt;'));
  });
  t('escala não devolve passo infinito nem laço travado', () => {
    assert.deepStrictEqual(Grafico.escala(0, 3).passos, [0]);
    assert.deepStrictEqual(Grafico.escala(-5, 3).passos, [0]);
    assert.deepStrictEqual(Grafico.escala(Infinity, 3).passos, [0]);
    assert.ok(Grafico.escala(3106, 3).passos.join(',') === '0,1000,2000,3000');
  });
}

console.log('\n' + passou + ' passaram, ' + falhou + ' falharam\n');
process.exit(falhou ? 1 : 0);
