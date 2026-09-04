// Logica compartilhada por index.html (interno) e cliente.html (versao do
// cliente, com PIN, so campanhas ativas e Popup/WhatsApp somados em Outros).
//
// As duas paginas usam ESTE arquivo de proposito. Duas copias do mesmo render
// foi exatamente o que fez a versao do cliente ficar para tras antes.
//
// O que muda entre as versoes vem do proprio DOM, sem flag espalhada:
//   - as colunas da tabela sao lidas do thead (data-col). Canal que nao tem
//     coluna propria e somado em "outros", que e como o cliente ve Popup e
//     WhatsApp juntos.
//   - se a pagina nao tem o botao #fAtivas, o filtro fica fixo em so ativas.
//   - se a pagina define window.AGUARDA_PIN, o carregar() nao dispara sozinho.

const SUPABASE_URL = "https://ltasijrhkotyyrxnavab.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YXNpanJoa290eXlyeG5hdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk5NDAsImV4cCI6MjA5NjcwNTk0MH0.XAJmbTSm6d5Y6xobOLceHlVr0e_iratHW_u6atzUC5c";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MONDAY_BOARD = "935301050";
const tipoOrder = {MBA:0, Curso:1, Institucional:2};
const rotulos = {MBA:'MBAs', Curso:'Cursos', Institucional:'Campanha de captação'};
const fmt = n => Number(n||0).toLocaleString('pt-BR');
const fmtR = n => 'R$ ' + Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
const fmtDate = iso => iso ? iso.split('-').reverse().slice(0,2).join('/') : '';

// Colunas desta pagina, na ordem em que o thead as declara.
const COLS = [...document.querySelectorAll('thead th')].map(th => th.dataset.col);
const tem = c => COLS.includes(c);
const NCOLS = COLS.length;

// Canais que o placar() devolve. Quem nao tem coluna propria cai em "outros".
const CANAIS = ['meta_ads','linkedin','form_prog','form_pagina','popup','whatsapp','outros'];

function canaisDaLinha(r){
  const v = {};
  CANAIS.forEach(c => v[c] = Number(r[c]) || 0);
  CANAIS.forEach(c => {
    if(c !== 'outros' && !tem(c) && tem('outros')){ v.outros += v[c]; v[c] = 0; }
  });
  return v;
}

const botaoAtivas = document.getElementById('fAtivas');
// Sem o botao, a pagina e a versao do cliente: so campanhas ativas, fixo.
let soAtivas = !botaoAtivas;
let ultimoData = null;

function alternarAtivas(){
  if(!botaoAtivas) return;
  soAtivas = !soAtivas;
  botaoAtivas.classList.toggle('on', soAtivas);
  if(ultimoData) renderizar(ultimoData);
}

(function setDefaultDates(){
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const toISO = d => d.toISOString().slice(0,10);
  document.getElementById('fIni').value = toISO(inicioMes);
  document.getElementById('fFim').value = toISO(hoje);
})();

function situacao(media, mediana){
  media = Number(media); mediana = Number(mediana);
  if(!mediana) return ['— sem histórico',''];
  if(media >= mediana) return ['Acima','b-verde'];
  if(media >= mediana*0.7) return ['Estável','b-amar'];
  return ['Abaixo','b-verm'];
}

async function carregar(){
  const ini = document.getElementById('fIni').value;
  const fim = document.getElementById('fFim').value;
  const corpo = document.getElementById('corpo');
  const erroBox = document.getElementById('erro');
  corpo.innerHTML = `<tr><td colspan="${NCOLS}" class="loading">Carregando…</td></tr>`;
  erroBox.innerHTML = '';

  const { data, error } = await sb.rpc('placar', { p_inicio: ini, p_fim: fim });
  if(error){
    erroBox.innerHTML = `<div class="erro">Erro ao carregar: ${error.message}</div>`;
    corpo.innerHTML = '';
    document.getElementById('tagTopo').textContent = 'erro de conexão';
    return;
  }
  ultimoData = data;
  document.getElementById('tagTopo').innerHTML = `<b>online</b> · ${data.length} cursos`;
  document.getElementById('atualizado').textContent =
    `atualizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  const br = iso => iso ? iso.split('-').reverse().join('/') : '';
  document.getElementById('printInfo').innerHTML =
    `<b>Placar de Leads · Fundação Vanzolini</b><br>` +
    `Período: ${br(ini)} a ${br(fim)}<br>` +
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  renderizar(data);
}

function renderizar(data){
  const corpo = document.getElementById('corpo');
  const rows = data
    .filter(r => soAtivas ? r.campanha_ativa : (r.leads > 0 || r.campanha_ativa))
    .sort((a,b)=>{
      if(tipoOrder[a.tipo]!==tipoOrder[b.tipo]) return tipoOrder[a.tipo]-tipoOrder[b.tipo];
      if(a.campanha_ativa!==b.campanha_ativa) return a.campanha_ativa?-1:1;
      return b.leads-a.leads;
    });

  corpo.innerHTML = '';
  let tipoAtual='';
  const soma={}; CANAIS.forEach(c=>soma[c]=0); soma.leads=0;
  let ativos=0, leadsAtivos=0, semLeadAtiva=0;
  let investTotal=0, leadsComInvest=0;
  data.forEach(r=>{
    if(Number(r.investimento) > 0){
      investTotal += Number(r.investimento);
      leadsComInvest += Number(r.leads)||0;
    }
  });

  const cel = v => v ? fmt(v) : '<span class="z">0</span>';

  rows.forEach(r=>{
    if(r.tipo!==tipoAtual){
      tipoAtual=r.tipo;
      corpo.insertAdjacentHTML('beforeend',
        `<tr class="grupo"><td class="curso" colspan="${NCOLS}">${rotulos[r.tipo]||r.tipo}</td></tr>`);
    }
    const v = canaisDaLinha(r);
    if(r.campanha_ativa){
      CANAIS.forEach(c=>soma[c]+=v[c]);
      soma.leads+=Number(r.leads)||0;
      ativos++; leadsAtivos+=Number(r.leads)||0;
      if(r.leads===0) semLeadAtiva++;
    }
    const [sit,cls] = situacao(r.media_dia, r.mediana_dia);
    const dpct = r.delta_pct;
    const dstr = (dpct===null||dpct===undefined) ? '<span class="z">—</span>'
        : `<span class="${dpct>=0?'up':'down'}">${dpct>=0?'+':''}${dpct}%</span>`;
    const pill = r.monday_item_id
        ? `<a class="pill-ativa" href="https://communitascom.monday.com/boards/${MONDAY_BOARD}/pulses/${r.monday_item_id}" target="_blank" rel="noopener" title="Abrir no Monday">ATIVA</a>`
        : `<span class="pill-ativa">ATIVA</span>`;
    const camp = r.campanha_ativa
        ? `<div class="camp">${pill}
           <span class="periodo">${fmtDate(r.campanha_inicio)}–${fmtDate(r.campanha_fim)}</span></div>`
        : '<span class="z">—</span>';
    const med = Number(r.mediana_dia) ? fmt(r.mediana_dia) : '<span class="z">—</span>';

    const celulas = {
      curso: `<td class="curso"><span class="nome">${r.curso}</span></td>`,
      campanha: `<td>${camp}</td>`,
      leads: `<td class="leads">${fmt(r.leads)}</td>`,
      delta: `<td>${dstr}</td>`,
      media: `<td>${fmt(r.media_dia)}</td>`,
      mediana: `<td>${med}</td>`,
      situacao: `<td>${cls?`<span class="badge ${cls}">${sit}</span>`:`<span class="z">${sit}</span>`}</td>`
    };
    CANAIS.forEach(c => celulas[c] = `<td>${cel(v[c])}</td>`);

    corpo.insertAdjacentHTML('beforeend',
      `<tr class="${r.campanha_ativa?'ativa':''}">${COLS.map(c=>celulas[c]||'<td></td>').join('')}</tr>`);
  });

  const totais = {
    curso: `<td class="curso">Total · campanhas ativas (${ativos})</td>`,
    campanha: '<td></td>',
    leads: `<td class="leads">${fmt(soma.leads)}</td>`,
    delta: '<td></td>', media: '<td></td>', mediana: '<td></td>', situacao: '<td></td>'
  };
  CANAIS.forEach(c => totais[c] = `<td>${fmt(soma[c])}</td>`);
  corpo.insertAdjacentHTML('beforeend',
    `<tr class="total">${COLS.map(c=>totais[c]||'<td></td>').join('')}</tr>`);

  document.getElementById('cards').innerHTML = `
    <div class="kpi"><div class="lbl">Leads · ativas</div><div class="val">${fmt(leadsAtivos)}</div>
      <div class="delta muted">${ativos} cursos</div></div>
    <div class="kpi"><div class="lbl">Campanhas ativas</div><div class="val">${ativos}</div>
      <div class="delta muted">no período</div></div>
    <div class="kpi"><div class="lbl">Canal líder</div><div class="val">Meta</div>
      <div class="delta muted">${soma.leads?`${Math.round(100*soma.meta_ads/soma.leads)}% dos ativos`:'—'}</div></div>
    <div class="kpi"><div class="lbl">CPL médio</div><div class="val">${leadsComInvest?'R$ '+(investTotal/leadsComInvest).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'<span class="z">sem dado</span>'}</div>
      <div class="delta muted">${leadsComInvest?`${fmtR(investTotal)} investidos ÷ ${fmt(leadsComInvest)} leads`:'sem turma com investimento no período'}</div></div>`;

  const alertaBox = document.getElementById('alerta');
  alertaBox.style.display = 'flex';
  document.getElementById('alertaTxt').innerHTML = semLeadAtiva>0
    ? `<b>${semLeadAtiva} campanha(s) ativa(s) sem lead</b> no período selecionado.`
    : `<b>Todas as ${ativos} campanhas ativas tiveram lead</b> em algum dia do período selecionado.`;
}

if(!window.AGUARDA_PIN) carregar();
