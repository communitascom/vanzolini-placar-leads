/* Performance de campanha (interno). Uma tela, uma chamada: toda a leitura vem
   de performance_campanha, e o desenho de grafico-campanha.js. Nada de conta
   nova aqui, para tela, PDF e a peca que o cliente ja viu nao divergirem. */
const SUPABASE_URL = "https://ltasijrhkotyyrxnavab.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YXNpanJoa290eXlyeG5hdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk5NDAsImV4cCI6MjA5NjcwNTk0MH0.XAJmbTSm6d5Y6xobOLceHlVr0e_iratHW_u6atzUC5c";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
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
    (a.tipo === 'MBA' ? 0 : 1) - (b.tipo === 'MBA' ? 0 : 1) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

function pintaCursos() {
  const sel = $('fCurso');
  sel.innerHTML = cursosUnicos().map(c =>
    `<option value="${c.id}">${c.tipo === 'MBA' ? 'MBA | ' : ''}${c.nome}</option>`).join('');
}

function pintaCampanhas() {
  const cursoId = Number($('fCurso').value);
  const lista = CAMPANHAS
    .filter(c => c.curso_id === cursoId)
    .sort((a, b) => String(b.data_inicio).localeCompare(String(a.data_inicio)));
  const rot = { vigente: 'vigente', encerrada: 'encerrada', futura: 'ainda não começou' };
  $('fCampanha').innerHTML = lista.map(c =>
    `<option value="${c.campanha_id}">${c.rotulo} (${rot[c.situacao] || c.situacao})${c.tem_plano ? '' : ' | sem plano'}</option>`).join('');
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
  $('aviso').innerHTML = txt
    ? `<p class="alerta ${tipo || ''}"><span class="ms">warning</span>${txt}</p>` : '';
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
async function render() {
  const campanhaId = Number($('fCampanha').value);
  if (!campanhaId) { aviso('selecione uma campanha'); return; }
  const { ini, fim } = periodoEscolhido();
  $('grafico').innerHTML = '<div class="skel"><i></i><i></i><i></i><i></i></div>';
  Dash.tag('<b>consultando</b>');

  const { data, error } = await sb.rpc('performance_campanha', {
    p_campanha_id: campanhaId, p_ini: ini, p_fim: fim, p_corte: null
  });

  if (error) {
    Dash.tag('<b>erro</b>', 'ruim');
    aviso('não consegui ler esta campanha: ' + error.message);
    $('grafico').innerHTML = '<p class="vazio">sem dado</p>';
    return;
  }
  if (data && data.erro) {
    Dash.tag('<b>sem dado</b>', 'atencao');
    aviso(data.erro);
    $('grafico').innerHTML = '<p class="vazio">' + data.erro + '</p>';
    ultimo = null;
    return;
  }

  ultimo = data;
  aviso(avisosDa(data).join(' '), 'atencao');
  GraficoCampanha.desenha($('grafico'), data);

  $('ph-titulo').textContent = data.campanha.curso;
  $('ph-sub').textContent = 'Captação x investimento | ' + brData(data.janela.campanha_ini) +
    ' a ' + brData(data.janela.campanha_fim) + ' | leitura até ' + brData(data.janela.corte);

  Dash.tag('<b>' + data.campanha.curso.slice(0, 28) + '</b>');
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

async function iniciarPainel() {
  Dash.tag('<b>conectando</b>');
  const { data, error } = await sb.rpc('performance_campanhas_lista');
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
window.iniciarPainel = iniciarPainel;
