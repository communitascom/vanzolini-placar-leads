// Início do Dashboard Vanzolini: os principais números de marketing do período, todos
// lidos das mesmas RPCs que alimentam os relatórios (placar, campanhas_andamento,
// midia_por_curso, institucional_*). Nada é calculado aqui que não exista lá.
const SUPABASE_URL = "https://ltasijrhkotyyrxnavab.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YXNpanJoa290eXlyeG5hdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk5NDAsImV4cCI6MjA5NjcwNTk0MH0.XAJmbTSm6d5Y6xobOLceHlVr0e_iratHW_u6atzUC5c";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const N = v => Math.round(Number(v || 0)).toLocaleString('pt-BR');
const N1 = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const BRL = v => 'R$ ' + N(v);
const BRL2 = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
const MI = v => v >= 1e6 ? Number(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi' : N(v);
const br = iso => iso ? iso.split('-').reverse().join('/') : '';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const COR_EIXO = { 'Institucional': '#E56B39', 'Cursos': '#1F6FD0', 'Organizações': '#0E9E76' };

function situacao(media, mediana) {
  media = Number(media); mediana = Number(mediana);
  if (!mediana) return ['sem histórico', 'b-cinza'];
  if (media >= mediana) return ['Acima', 'b-verde'];
  if (media >= mediana * 0.7) return ['Estável', 'b-amar'];
  return ['Abaixo', 'b-verm'];
}
function kpi(ico, cor, rot, val, nota) {
  return `<div class="kpi compacto"><div class="topo"><span class="rot">${rot}</span><span class="tile ${cor}"><span class="ms">${ico}</span></span></div><div class="valor"><span class="n">${val}</span></div><div class="nota">${nota}</div></div>`;
}

// ---------- período ----------
function presetsPeriodo() {
  const h = new Date();
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const mesAtualIni = new Date(h.getFullYear(), h.getMonth(), 1);
  const mesAntIni = new Date(h.getFullYear(), h.getMonth() - 1, 1);
  const mesAntFim = new Date(h.getFullYear(), h.getMonth(), 0);
  return [
    { k: 'mes', rot: 'Mês atual', ini: iso(mesAtualIni), fim: iso(h) },
    { k: 'ant', rot: 'Mês anterior', ini: iso(mesAntIni), fim: iso(mesAntFim) }
  ];
}
function montarFiltros() {
  const host = document.getElementById('presets');
  host.innerHTML = presetsPeriodo().map(p => `<button class="chip" data-k="${p.k}" data-ini="${p.ini}" data-fim="${p.fim}"><span class="ms">calendar_month</span>${p.rot}</button>`).join('');
  host.querySelectorAll('.chip').forEach(b => b.onclick = () => aplicar(b.dataset.ini, b.dataset.fim, b.dataset.k));
  document.getElementById('btnAplicar').onclick = () => aplicar(document.getElementById('fIni').value, document.getElementById('fFim').value, null);
}
async function aplicar(ini, fim, k) {
  if (!ini || !fim || ini > fim) return;
  document.getElementById('fIni').value = ini;
  document.getElementById('fFim').value = fim;
  document.querySelectorAll('#presets .chip').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  await carregarPeriodo(ini, fim);
}

window.iniciarPainel = async function () {
  montarFiltros();
  const p = presetsPeriodo()[0];
  await aplicar(p.ini, p.fim, 'mes');
};

async function carregarPeriodo(ini, fim) {
  const h = new Date();
  const pad = n => String(n).padStart(2, '0');
  const rotPeriodo = ini === fim ? br(ini) : br(ini) + ' a ' + br(fim);

  const [pl, ca, mi, inst, rep] = await Promise.all([
    sb.rpc('placar', { p_inicio: ini, p_fim: fim }),
    sb.rpc('campanhas_andamento'),
    sb.rpc('midia_por_curso', { p_inicio: ini, p_fim: fim }),
    sb.rpc('institucional_serie', { p_ini: ini, p_fim: fim }),
    sb.rpc('institucional_reportei_lista')
  ]);
  const erro = pl.error || ca.error || mi.error || inst.error || rep.error;
  if (erro) {
    document.getElementById('leituraTxt').textContent = 'Erro ao carregar: ' + erro.message;
    if (window.Dash) Dash.tag('<b>erro de conexão</b>', 'erro');
    return;
  }
  const placar = pl.data || [], camp = ca.data || [], midia = mi.data || [], serie = inst.data || [], fotos = rep.data || [];

  // leads do período (campanhas ativas), como o placar do cliente
  const ativas = placar.filter(r => r.campanha_ativa);
  const leads = ativas.reduce((a, r) => a + (Number(r.leads) || 0), 0);
  const metaLeads = ativas.reduce((a, r) => a + (Number(r.meta_ads) || 0), 0);
  const acima = ativas.filter(r => Number(r.mediana_dia) && Number(r.media_dia) >= Number(r.mediana_dia)).length;
  const abaixo = ativas.filter(r => Number(r.mediana_dia) && Number(r.media_dia) < Number(r.mediana_dia) * 0.7).length;

  // investimento do período: captação (midia_por_curso) + institucional (institucional_serie)
  const invCapt = midia.reduce((a, m) => a + (Number(m.investimento) || 0), 0);
  const invInst = serie.reduce((a, r) => a + (Number(r.investimento) || 0), 0);
  const imprInst = serie.reduce((a, r) => a + (Number(r.impressoes) || 0), 0);
  const cliInst = serie.reduce((a, r) => a + (Number(r.cliques) || 0), 0);
  const cpmInst = imprInst ? 1000 * invInst / imprInst : 0;
  const cpcInst = cliInst ? invInst / cliInst : 0;
  const ctrInst = imprInst ? 100 * cliInst / imprInst : 0;
  const porEixo = {}; serie.forEach(r => porEixo[r.eixo] = (porEixo[r.eixo] || 0) + (Number(r.investimento) || 0));

  // alcance institucional do período, quando a foto do Reportei cobre o mesmo mês
  const mesFoto = fotos.filter(f => f.granularidade === 'mes' && f.periodo_ini === ini.slice(0, 7) + '-01');
  const alcMeta = mesFoto.filter(f => f.plataforma === 'Meta' && f.nivel === 'campanha' && /institucional/i.test(f.nome)).reduce((a, f) => a + (Number(f.m.alcance) || 0), 0);
  const alcLi = mesFoto.filter(f => f.plataforma === 'LinkedIn' && f.nivel === 'conta').reduce((a, f) => {
    const ii = Number(f.m.impressoes_institucional) || 0, ic = Number(f.m.impressoes_conta) || 0;
    return a + ((ic && ii / ic >= 0.9) ? (Number(f.m.alcance) || 0) : 0);
  }, 0);
  const alc = alcMeta + alcLi;
  const freq = alc ? imprInst / alc : null;

  // leitura do período
  let t = `No período, <b>${N(leads)} leads</b> em ${ativas.length} campanhas de captação ativas`;
  if (leads) t += ` (Meta responde por ${Math.round(100 * metaLeads / leads)}%)`;
  t += `, ${acima} acima da mediana histórica` + (abaixo ? ` e ${abaixo} abaixo` : '') + '. ';
  t += `Mídia: <b>${BRL(invCapt + invInst)}</b>, sendo ${BRL(invCapt)} em captação e ${BRL(invInst)} na campanha institucional`;
  t += imprInst ? `, que entregou ${MI(imprInst)} impressões` + (alc ? ` e alcançou ${N(alc)} pessoas em Meta e LinkedIn.` : '.') : '.';
  document.getElementById('leituraTxt').innerHTML = t;

  // indicadores comerciais
  document.getElementById('kpis').innerHTML =
    kpi('group', 'laranja', 'Leads no período', N(leads), ativas.length + ' campanhas de captação ativas') +
    kpi('campaign', 'azul', 'Campanhas no ar', N(camp.length), camp.filter(c => c.proj_leads).length + ' com projeção de fechamento') +
    kpi('payments', 'roxo', 'Mídia investida', BRL(invCapt + invInst), BRL(invCapt) + ' captação · ' + BRL(invInst) + ' institucional') +
    kpi('leaderboard', 'verde', 'Situação das campanhas', acima + '/' + ativas.length, acima + ' acima da mediana histórica');

  // indicadores institucionais (números grandes: alcance, impressões, cliques, CPM, CPC)
  const kInst = [];
  kInst.push(kpi('visibility', 'roxo', 'Impressões', MI(imprInst), 'Google + Meta + LinkedIn'));
  kInst.push(kpi('group', 'laranja', alc ? 'Alcance' : 'Alcance', alc ? N(alc) : 'sem dado', alc ? 'Meta + LinkedIn no período' : 'aguardando foto do Reportei'));
  kInst.push(kpi('ads_click', 'azul', 'Cliques', N(cliInst), 'CTR ' + PCT(ctrInst)));
  kInst.push(kpi('payments', 'verde', 'CPM', BRL2(cpmInst), 'custo por mil impressões'));
  kInst.push(kpi('repeat', 'roxo', freq ? 'Frequência' : 'CPC', freq ? N1(freq) + '×' : BRL2(cpcInst), freq ? 'impressões ÷ alcance' : 'custo por clique'));
  document.getElementById('kpisInst').innerHTML = kInst.join('');

  // campanhas de captação no ar (ordenadas por leads)
  const top = camp.slice().sort((a, b) => Number(b.leads || 0) - Number(a.leads || 0)).slice(0, 7);
  const maxLeads = Math.max(1, ...top.map(c => Number(c.leads || 0)));
  document.getElementById('listaCamp').innerHTML = top.length ? top.map((c, i) => {
    const vs = Number(c.vs_historico);
    const cls = isNaN(vs) || c.vs_historico === null ? 'b-cinza' : vs >= 10 ? 'b-verde' : vs <= -15 ? 'b-verm' : 'b-amar';
    const rot = c.vs_historico === null || c.vs_historico === undefined ? 'sem base' : (vs >= 0 ? '+' : '') + vs + '% vs. histórico';
    return `<div class="it"><span class="pos">${i + 1}</span><div class="tx"><span class="t1">${c.curso}</span><span class="t2">${c.data_inicio.slice(8, 10)}/${c.data_inicio.slice(5, 7)} a ${c.data_fim.slice(8, 10)}/${c.data_fim.slice(5, 7)} · ${c.dias_restantes} dias restantes${c.proj_leads ? ' · projeção ' + N(c.proj_leads) : ''}</span></div>
      <div class="vl"><span class="mini"><i style="width:${100 * Number(c.leads || 0) / maxLeads}%"></i></span>${N(c.leads)}<span class="badge ${cls}">${rot}</span></div></div>`;
  }).join('') : '<div class="estado-vazio"><span class="ms">campaign</span>Nenhuma campanha no ar hoje</div>';

  // institucional no período por eixo
  const eixos = ['Institucional', 'Cursos', 'Organizações'];
  const totInst = eixos.reduce((a, e) => a + (porEixo[e] || 0), 0);
  document.getElementById('instEixos').innerHTML = totInst
    ? `<div class="stack">${eixos.filter(e => porEixo[e]).map(e => `<i style="width:${100 * porEixo[e] / totInst}%;background:${COR_EIXO[e]}"></i>`).join('')}</div>
       <div class="stack-leg">${eixos.map(e => `<span><i style="background:${COR_EIXO[e]}"></i>${e}<b>${BRL(porEixo[e] || 0)}</b></span>`).join('')}</div>`
    : '<div class="estado-vazio"><span class="ms">verified</span>Sem mídia institucional registrada no período</div>';

  // leads por curso no período (placar, campanhas ativas), com botão para o placar completo
  const cursos = ativas.slice().sort((a, b) => Number(b.leads) - Number(a.leads)).slice(0, 5);
  const maxC = Math.max(1, ...cursos.map(c => Number(c.leads)));
  document.getElementById('hbCursos').innerHTML = cursos.length ? cursos.map(c => {
    const [s, cls] = situacao(c.media_dia, c.mediana_dia);
    return `<div class="hbar"><span class="nome">${c.curso} <span class="badge ${cls}" style="margin-left:6px">${s}</span></span><span class="val">${N(c.leads)}</span><span class="trilho"><span class="fill" style="display:block;width:${100 * Number(c.leads) / maxC}%"></span></span></div>`;
  }).join('') : '<div class="estado-vazio"><span class="ms">group</span>Sem lead em campanha ativa no período</div>';

  document.getElementById('horaRodape').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (window.Dash) Dash.tag('<b>online</b> · ' + ativas.length + ' campanhas ativas');
}
