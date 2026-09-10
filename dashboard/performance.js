/* Performance de campanha (interno). Uma tela, uma chamada: toda a leitura vem
   de performance_campanha, e o desenho de grafico-campanha.js. Nada de conta
   nova aqui, para tela, PDF e a peca que o cliente ja viu nao divergirem. */
const SUPABASE_URL = "https://ltasijrhkotyyrxnavab.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YXNpanJoa290eXlyeG5hdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk5NDAsImV4cCI6MjA5NjcwNTk0MH0.XAJmbTSm6d5Y6xobOLceHlVr0e_iratHW_u6atzUC5c";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const vazio = txt => { const p = document.createElement('p'); p.className = 'vazio'; p.textContent = txt; return p; };
const brData = iso => iso ? String(iso).split('-').reverse().join('/') : '';
const pad = n => String(n).padStart(2, '0');
const isoDe = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

let CAMPANHAS = [];   // catalogo devolvido por performance_campanhas_lista
let ultimo = null;    // ultima resposta, usada pelo cabecalho de impressao

// ---------- filtros ----------
function cursosUnicos() {
  const vistos = new Map();
  CAMPANHAS.forEach(c => {
    if (!vistos.has(c.curso_id)) vistos.set(c.curso_id, { id: c.curso_id, nome: c.curso, tipo: c.tipo, n: 0 });
    vistos.get(c.curso_id).n++;
  });
  // MBA primeiro, porque e onde existe plano de midia e a tela fica completa
  return [...vistos.values()].sort((a, b) =>
    (a.tipo === 'MBA' ? 0 : 1) - (b.tipo === 'MBA' ? 0 : 1) ||
    String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
}

// Monto as opções por DOM, com textContent. Antes o nome do curso e o rótulo da
// campanha, que vêm do banco, entravam direto em innerHTML.
function opcao(valor, texto) {
  const o = document.createElement('option');
  o.value = String(valor);
  o.textContent = texto;
  return o;
}

function pintaCursos() {
  const sel = $('fCurso');
  sel.replaceChildren(...cursosUnicos().map(c =>
    opcao(c.id, (c.tipo === 'MBA' ? 'MBA | ' : '') + c.nome)));
}

function pintaCampanhas() {
  const cursoId = Number($('fCurso').value);
  const lista = CAMPANHAS
    .filter(c => c.curso_id === cursoId)
    .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)));
  const rot = { vigente: 'vigente', encerrada: 'encerrada', futura: 'ainda não começou' };
  $('fCampanha').replaceChildren(...lista.map(c =>
    opcao(c.campanha_id,
      c.rotulo + ' (' + (rot[c.situacao] || c.situacao) + ')' + (c.tem_plano ? '' : ' | sem plano'))));
}

function periodoEscolhido() {
  const modo = $('fPeriodo').value;
  const h = new Date();
  if (modo === 'mes') {
    return { ini: isoDe(new Date(h.getFullYear(), h.getMonth(), 1)),
             fim: isoDe(new Date(h.getFullYear(), h.getMonth() + 1, 0)) };
  }
  if (modo === 'mesant') {
    return { ini: isoDe(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
             fim: isoDe(new Date(h.getFullYear(), h.getMonth(), 0)) };
  }
  if (modo === 'livre') {
    return { ini: $('fIni').value || null, fim: $('fFim').value || null };
  }
  return { ini: null, fim: null };  // campanha inteira
}

// ---------- avisos ----------
function aviso(txt, tipo) {
  const host = $('aviso');
  if (!txt) { host.replaceChildren(); return; }
  const p = document.createElement('p');
  p.className = 'alerta ' + (tipo || '');
  const i = document.createElement('span');
  i.className = 'ms'; i.textContent = 'warning';
  p.append(i, document.createTextNode(txt));
  host.replaceChildren(p);
}

function avisosDa(d) {
  const av = [];
  if (d.campanha && d.campanha.tipo === 'MBA' && !d.campanha.tem_plano) {
    av.push('Este MBA não tem plano de mídia cadastrado, então a meta ajustada e a projeção pela verba ficam de fora.');
  }
  if (d.campanha && d.campanha.sobreposta_com) {
    av.push('Este curso tem outra campanha com janela sobreposta. A mídia e os leads são atribuídos por curso e data, '
      + 'então os dias em comum aparecem nas duas leituras e não devem ser somados.');
  }
  if (d.plano && d.plano.meta_ajustada == null) {
    av.push('A campanha não tem meta registrada, então a linha de meta não aparece no gráfico.');
  }
  if (d.realizado && Number(d.realizado.verba_excedida) > 0) {
    av.push('O investimento já passou a verba em R$ '
      + Number(d.realizado.verba_excedida).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '.');
  }
  if (d.referencia && d.referencia.modo === 'historico') {
    av.push('Leitura histórica: os leads seguem o estado atual do placar, que é reprocessado, então podem diferir do que a tela mostrava naquele dia.');
  }
  return av;
}

// ---------- carga ----------
// Contador de sequência: trocar de curso duas vezes rápido fazia a resposta
// lenta da primeira chegar depois e sobrescrever a segunda na tela.
let sequencia = 0;

async function render() {
  const meu = ++sequencia;
  const campanhaId = Number($('fCampanha').value);
  if (!campanhaId) { aviso('selecione uma campanha'); return; }
  const { ini, fim } = periodoEscolhido();
  const corte = $('fCorte').value || null;
  $('grafico').innerHTML = '<div class="skel"><i></i><i></i><i></i><i></i></div>';
  Dash.tag('<b>consultando</b>');

  let data, error;
  try {
    ({ data, error } = await sb.rpc('performance_campanha', {
      p_campanha_id: campanhaId, p_ini: ini, p_fim: fim, p_corte: corte
    }));
  } catch (e) {
    error = { message: String(e && e.message || e) };
  }
  if (meu !== sequencia) return;  // já saiu outra consulta na frente

  if (error) {
    Dash.tag('<b>erro</b>', 'ruim');
    aviso('não consegui ler esta campanha: ' + error.message);
    $('grafico').replaceChildren(vazio('sem dado'));
    ultimo = null;
    return;
  }
  // O erro nomeado vem PRIMEIRO. A guarda de contrato estava na frente e
  // engolia CURSO_SEM_MIDIA, CAMPANHA_FUTURA e companhia, trocando a mensagem
  // certa por "formato inesperado".
  if (data && data.erro) {
    Dash.tag('<b>sem dado</b>', 'atencao');
    aviso(data.erro);
    $('grafico').replaceChildren(vazio(data.erro));
    ultimo = null;
    return;
  }
  if (!data || !data.campanha || !data.janela || !data.realizado || !Array.isArray(data.serie)) {
    Dash.tag('<b>sem dado</b>', 'atencao');
    aviso('a resposta da API veio em formato inesperado');
    $('grafico').replaceChildren(vazio('sem dado'));
    ultimo = null;
    return;
  }

  ultimo = data;
  aviso(avisosDa(data).join(' '), 'atencao');
  GraficoCampanha.desenha($('grafico'), data);

  $('ph-titulo').textContent = data.campanha.curso;
  $('ph-sub').textContent = 'Captação x investimento | ' + brData(data.janela.campanha_ini) +
    ' a ' + brData(data.janela.campanha_fim) + ' | leitura até ' + brData(data.janela.corte);

  Dash.tag('<b>' + esc(String(data.campanha.curso || '').slice(0, 28)) + '</b>');
  Dash.stamp();
  const hr = $('horaRodape'); if (hr) hr.textContent = Dash.hora();
}

// impressao: o shell chama isto antes de abrir o dialogo
window.imprimirPagina = function () {
  if (ultimo) {
    document.title = 'Vanzolini | ' + ultimo.campanha.curso + ' | ' + brData(ultimo.janela.corte);
  }
  window.print();
};

async function carregarTela() {
  Dash.tag('<b>conectando</b>');
  let data, error;
  try {
    ({ data, error } = await sb.rpc('performance_campanhas_lista'));
  } catch (e) {
    error = { message: String(e && e.message || e) };
  }
  if (error) {
    Dash.tag('<b>erro</b>', 'ruim');
    aviso('não consegui carregar a lista de campanhas: ' + error.message);
    return;
  }
  CAMPANHAS = data || [];
  if (!CAMPANHAS.length) { aviso('nenhuma campanha cadastrada'); return; }

  pintaCursos();
  pintaCampanhas();

  $('fCurso').addEventListener('change', () => { pintaCampanhas(); render(); });
  $('fCampanha').addEventListener('change', render);
  $('fPeriodo').addEventListener('change', () => {
    const livre = $('fPeriodo').value === 'livre';
    $('campoIni').classList.toggle('oculto', !livre);
    $('campoFim').classList.toggle('oculto', !livre);
    if (!livre) render();
  });
  $('fIni').addEventListener('change', render);
  $('fFim').addEventListener('change', render);
  $('fCorte').addEventListener('change', render);

  // abre na campanha vigente se houver, senao na mais recente
  const vig = CAMPANHAS.find(c => c.situacao === 'vigente' && c.tipo === 'MBA')
           || CAMPANHAS.find(c => c.situacao === 'vigente');
  if (vig) {
    $('fCurso').value = String(vig.curso_id);
    pintaCampanhas();
    $('fCampanha').value = String(vig.campanha_id);
  }
  render();
}
// O shell chama sem await, então qualquer exceção viraria rejeição não tratada
// e a tela ficaria em "conectando" para sempre, sem dizer o porquê.
// A função interna tem nome próprio de propósito: declaração de função no topo
// cria binding global, e window.iniciarPainel = ... sobrescrevia esse binding,
// fazendo o wrapper chamar a si mesmo até estourar a pilha.
window.iniciarPainel = function () {
  carregarTela().catch(e => {
    Dash.tag('<b>erro</b>', 'ruim');
    aviso('falha ao iniciar a tela: ' + String(e && e.message || e));
  });
};
