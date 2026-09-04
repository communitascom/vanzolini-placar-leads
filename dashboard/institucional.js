// Campanha institucional Vanzolini 2026, em uma página.
//
// Fontes:
//   - midia_diaria (Supabase, carga automática às 6h e 18h da planilha consolidada):
//     investimento, impressões e cliques por dia e campanha. É a mesma base do PDF
//     Resumo_Institucional (bate centavo a centavo). RPCs institucional_serie e
//     institucional_campanhas já filtram as campanhas institucionais de 2026 e
//     classificam o eixo pelo nome.
//   - institucional_reportei (fotos mensais e acumulada do Reportei): alcance e
//     frequência (Meta, LinkedIn), vídeos, anúncios, GA4 e busca pela marca.
//   - institucional_plano: verba prevista por eixo e mês.
//
// Regras editoriais do padrão Painéis Communitas: número BR, sem travessão, toda
// variação diz contra o quê, CTR e CPM calculados dos totais (nunca média de médias).

const SUPABASE_URL = "https://ltasijrhkotyyrxnavab.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YXNpanJoa290eXlyeG5hdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk5NDAsImV4cCI6MjA5NjcwNTk0MH0.XAJmbTSm6d5Y6xobOLceHlVr0e_iratHW_u6atzUC5c";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CAMPANHA_INI = '2026-04-01';
const EIXOS = ['Institucional', 'Cursos', 'Organizações'];
const OBJ = {
  'Institucional': 'Fortalecer a marca Vanzolini de forma ampla (Vanzolini, 4 áreas).',
  'Cursos': 'Gerar demanda e reconhecimento para cursos e MBAs.',
  'Organizações': 'Construir presença de marca junto a organizações (B2B).'
};
const PLATS = ['Meta', 'Google', 'LinkedIn'];
const COR = { Meta: '#1F6FD0', Google: '#E56B39', LinkedIn: '#0E9E76' };          // séries fixas do padrão
const COR_EIXO = { 'Institucional': '#E56B39', 'Cursos': '#1F6FD0', 'Organizações': '#0E9E76' };

const N = v => Math.round(Number(v || 0)).toLocaleString('pt-BR');
const N1 = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const N2 = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BRL = v => 'R$ ' + N(v);
const BRL2 = v => 'R$ ' + N2(v);
const PCT = (v, d) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }) + '%';
const MI = v => v >= 1e6 ? N2(v / 1e6).replace(',00', '') + ' mi' : N(v);
const br = iso => iso ? iso.split('-').reverse().join('/') : '';
const brCurto = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
const hojeISO = () => new Date().toISOString().slice(0, 10);
const PEND = '<span class="z">aguardando carga</span>';

function eixoDe(nome) {
  const n = String(nome || '');
  if (/organiza|certifica|in company/i.test(n)) return 'Organizações';
  if (/curso|mba/i.test(n)) return 'Cursos';
  return 'Institucional';
}
function ehInstitucional(nome) {
  const n = String(nome || '');
  return /^(Meta|Lkd) \| Institucional/i.test(n) || /^Institucional \| (Geral|Cursos)/i.test(n) ||
    /^(display|youtube)_institucional/i.test(n) || /^institucional_cursos_mba/i.test(n) || /institucional/i.test(n);
}
function ehVideo(nome) { return /v[ií]deo|_video|youtube|^v\d|^vd|_\d+s\b|thruplay/i.test(String(nome || '')); }

// ---------- estado ----------
let PLANO = [], REP = [], SERIE = [], CAMP = [], MIDIA_ATE = null;
let periodo = { ini: null, fim: null, rot: '' };

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
    { k: 'ant', rot: 'Mês anterior', ini: iso(mesAntIni), fim: iso(mesAntFim) },
    { k: 'camp', rot: 'Campanha (desde abr/26)', ini: CAMPANHA_INI, fim: iso(h) }
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
  periodo = { ini, fim, k, fimPlano: k === 'mes' ? fimDoMes(fim) : fim };
  document.getElementById('fIni').value = ini;
  document.getElementById('fFim').value = fim;
  document.querySelectorAll('#presets .chip').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  await carregarPeriodo();
  render();
}

// ---------- carga ----------
async function carregarBase() {
  const [p, r, m] = await Promise.all([
    sb.rpc('institucional_plano_lista'),
    sb.rpc('institucional_reportei_lista'),
    sb.rpc('midia_atualizada_ate')
  ]);
  if (p.error || r.error) throw new Error((p.error || r.error).message);
  PLANO = p.data || []; REP = r.data || []; MIDIA_ATE = m.data || null;
}
async function carregarPeriodo() {
  const [s, c] = await Promise.all([
    sb.rpc('institucional_serie', { p_ini: periodo.ini, p_fim: periodo.fim }),
    sb.rpc('institucional_campanhas', { p_ini: periodo.ini, p_fim: periodo.fim })
  ]);
  if (s.error || c.error) throw new Error((s.error || c.error).message);
  SERIE = s.data || []; CAMP = c.data || [];
}

// ---------- fotos do Reportei que valem para o período ----------
// Retorna {linhas, modo, nota}. modo: 'acumulado' (uma foto cobre o período),
// 'meses' (soma de fotos mensais), 'nenhum'. Alcance só é somado entre meses com aviso.
function fotos() {
  const ini = periodo.ini, fim = periodo.fim;
  const acum = REP.filter(r => r.granularidade === 'acumulado' && r.periodo_ini === ini && r.periodo_fim >= addDias(fim, -4));
  if (acum.length) return { linhas: acum, modo: 'acumulado', meses: 1, nota: '' };
  const meses = REP.filter(r => r.granularidade === 'mes' && r.periodo_ini >= ini.slice(0, 7) + '-01' && r.periodo_ini <= fim);
  const chaves = [...new Set(meses.map(r => r.periodo_ini.slice(0, 7)))];
  if (!chaves.length) return { linhas: [], modo: 'nenhum', meses: 0, nota: 'Sem foto do Reportei para este período.' };
  const cobreIni = chaves.includes(ini.slice(0, 7)), cobreFim = chaves.includes(fim.slice(0, 7));
  let nota = '';
  if (chaves.length > 1) nota = 'Alcance somado entre ' + chaves.length + ' fotos mensais: a mesma pessoa pode contar mais de uma vez.';
  if (!cobreIni || !cobreFim) nota += (nota ? ' ' : '') + 'A foto do Reportei não cobre todo o período.';
  return { linhas: meses, modo: 'meses', meses: chaves.length, nota };
}
function addDias(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function fimDoMes(iso) { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000) + 1; }
const somaM = (linhas, chave) => linhas.reduce((a, r) => a + (Number(r.m && r.m[chave]) || 0), 0);

// ---------- agregações ----------
function totais(rows) {
  const t = { inv: 0, impr: 0, cli: 0 };
  rows.forEach(r => { t.inv += Number(r.investimento) || 0; t.impr += Number(r.impressoes) || 0; t.cli += Number(r.cliques) || 0; });
  t.ctr = t.impr ? 100 * t.cli / t.impr : 0;
  t.cpm = t.impr ? 1000 * t.inv / t.impr : 0;
  t.cpc = t.cli ? t.inv / t.cli : 0;
  return t;
}
// alcance e frequência por plataforma a partir das fotos (Meta por campanha; LinkedIn por conta, se atribuível)
function alcancePlat(f, plat, eixo) {
  const L = f.linhas.filter(r => r.plataforma === plat);
  if (plat === 'Meta') {
    const c = L.filter(r => r.nivel === 'campanha' && ehInstitucional(r.nome) && (!eixo || eixoDe(r.nome) === eixo));
    const alc = somaM(c, 'alcance'), impr = somaM(c, 'impressoes');
    return alc ? { alcance: alc, freq: impr / alc, base: 'campanhas institucionais' } : null;
  }
  if (plat === 'LinkedIn' && !eixo) {
    const contas = L.filter(r => r.nivel === 'conta');
    let alc = 0, impr = 0, ok = false;
    contas.forEach(r => {
      const ii = Number(r.m.impressoes_institucional) || 0, ic = Number(r.m.impressoes_conta) || 0, a = Number(r.m.alcance) || 0;
      if (a && ic && ii / ic >= 0.9) { alc += a; impr += ic; ok = true; }
    });
    return ok ? { alcance: alc, freq: impr / alc, base: 'contas só com campanhas institucionais' } : null;
  }
  return null;
}
function anunciosPorEixo(f, eixo) {
  return f.linhas.filter(r => r.nivel === 'anuncio' && ((r.campanha && ehInstitucional(r.campanha) && eixoDe(r.campanha) === eixo) || (!r.campanha && r.eixo === eixo)))
    .map(r => ({ plat: r.plataforma, nome: r.nome, campanha: r.campanha, inv: Number(r.m.investimento) || 0, impr: Number(r.m.impressoes) || 0,
      alc: Number(r.m.alcance) || 0, cli: Number(r.m.cliques) || 0, ctr: Number(r.m.ctr) || 0, cpm: Number(r.m.cpm) || 0 }))
    .sort((a, b) => b.impr - a.impr);
}

// ---------- render ----------
function render() {
  const f = fotos();
  const t = totais(CAMP);
  const porPlat = {}; PLATS.forEach(p => porPlat[p] = totais(CAMP.filter(c => c.plataforma === p)));
  const porEixo = {}; EIXOS.forEach(e => porEixo[e] = totais(CAMP.filter(c => c.eixo === e)));

  // alcance consolidado (Meta + LinkedIn)
  // Alcance só entra quando a plataforma teve veiculação registrada no período (midia_diaria).
  // A foto do Reportei pode estar à frente da planilha; nesse caso o alcance sem investimento
  // confundiria mais do que informaria.
  const aM = porPlat.Meta.impr ? alcancePlat(f, 'Meta') : null;
  const aL = porPlat.LinkedIn.impr ? alcancePlat(f, 'LinkedIn') : null;
  const alc = (aM ? aM.alcance : 0) + (aL ? aL.alcance : 0);
  const imprAlc = (aM ? aM.alcance * aM.freq : 0) + (aL ? aL.alcance * aL.freq : 0);
  const freq = alc ? imprAlc / alc : null;
  const quem = [aM ? 'Meta' : null, aL ? 'LinkedIn' : null].filter(Boolean).join(' + ');

  // leitura automática
  const lider = PLATS.slice().sort((a, b) => porPlat[b].impr - porPlat[a].impr)[0];
  const melhorCtr = PLATS.filter(p => porPlat[p].impr).sort((a, b) => porPlat[b].ctr - porPlat[a].ctr)[0];
  let leitura = CAMP.length
    ? `No período, <b>${BRL(t.inv)}</b> investidos em ${CAMP.length} campanhas geraram <b>${MI(t.impr)} impressões</b> e ${N(t.cli)} cliques (CTR ${PCT(t.ctr)}, CPM ${BRL2(t.cpm)}). `
      + `${lider} concentra ${Math.round(100 * porPlat[lider].impr / (t.impr || 1))}% das impressões` + (melhorCtr ? ` e ${melhorCtr} tem o melhor CTR (${PCT(porPlat[melhorCtr].ctr)}).` : '.')
    : 'Sem campanha institucional com mídia registrada no período.';
  if (alc) leitura += ` Alcance de <b>${N(alc)} pessoas</b> em ${quem}, frequência média de ${N1(freq)}` + (aM && aL ? '.' : ` (só ${quem} informa alcance no período).`);
  document.getElementById('leituraTxt').innerHTML = leitura;

  // KPIs consolidados
  const k = [];
  k.push(kpi('payments', 'roxo', 'Investimento', BRL(t.inv), 'Google + Meta + LinkedIn'));
  k.push(kpi('visibility', 'azul', 'Impressões', MI(t.impr), 'CPM ' + BRL2(t.cpm)));
  k.push(kpi('group', 'laranja', 'Alcance', alc ? N(alc) : null, alc ? quem + '; Google só informa impressões' : 'aguardando foto do Reportei', !alc));
  k.push(kpi('repeat', 'verde', 'Frequência média', freq ? N1(freq) + '×' : null, freq ? 'impressões ÷ alcance, ' + quem : 'sem alcance no período', !freq));
  k.push(kpi('ads_click', 'azul', 'Cliques', N(t.cli), 'CPC ' + BRL2(t.cpc)));
  k.push(kpi('trending_up', 'verde', 'CTR', PCT(t.ctr), 'cliques ÷ impressões'));
  document.getElementById('kpis').innerHTML = k.join('');
  document.getElementById('notaFotos').innerHTML = f.nota ? `<span class="ms">info</span>${f.nota}` : '';

  renderPlataformas(porPlat, t, f);
  renderEvolucao();
  renderEixos(porEixo, f);
  renderVideos(f);
  renderTrafego(f);
  renderRodape(f);
  if (window.Dash) Dash.tag('<b>online</b> · ' + CAMP.length + ' campanhas');
}

function kpi(ico, cor, rot, val, nota, pend) {
  const semDado = val === null || val === undefined;
  let valorHtml = 'sem dado';
  if (!semDado) {
    const m = String(val).match(/^(R\$)\s*(.+)$/);
    valorHtml = m ? `<span class="cifrao">${m[1]}</span> <span class="n">${m[2]}</span>` : `<span class="n">${val}</span>`;
  }
  return `<div class="kpi compacto${pend ? ' pend' : ''}"><div class="topo"><span class="rot">${rot}</span><span class="tile ${cor}"><span class="ms">${ico}</span></span></div>
    <div class="valor">${valorHtml}</div><div class="nota${pend ? ' aviso' : ''}">${nota}</div></div>`;
}

function stack(partes, total) {
  const tot = total || partes.reduce((a, p) => a + p.v, 0) || 1;
  return `<div class="stack">${partes.filter(p => p.v > 0).map(p => `<i style="width:${100 * p.v / tot}%;background:${p.cor}" title="${p.rot}: ${Math.round(100 * p.v / tot)}%"></i>`).join('')}</div>
    <div class="stack-leg">${partes.map(p => `<span><i style="background:${p.cor}"></i>${p.rot}<b>${tot && p.v ? Math.round(100 * p.v / tot) + '%' : '0%'}</b></span>`).join('')}</div>`;
}

const ICONE_PLAT = {
  Meta: '<svg viewBox="0 0 36 36" width="20" height="20"><path fill="#0866FF" d="M18 3C9.7 3 3 9.4 3 17.3c0 4.5 2.2 8.5 5.6 11.1v5.4l5.1-2.8c1.4.4 2.8.6 4.3.6 8.3 0 15-6.4 15-14.3S26.3 3 18 3z"/><path fill="#fff" d="M9.7 22.6l4.1-6.5 4.1 3.1 4-4.4-4.3 6.7-4.1-3.1-3.8 4.2z"/></svg>',
  Google: '<svg viewBox="0 0 36 36" width="20" height="20"><path fill="#4285F4" d="M33.1 18.4c0-1.2-.1-2.1-.3-3H18v5.9h8.5c-.2 1.5-1.2 3.7-3.3 5.1l-.03.2 4.9 3.7.3.03c3.1-2.8 4.9-7 4.9-11.9z"/><path fill="#34A853" d="M18 34c4.4 0 8.1-1.4 10.9-3.9l-5.2-4c-1.4.9-3.3 1.6-5.7 1.6-4.4 0-8.1-2.9-9.4-6.9l-.19.02-5.1 3.9-.07.18C6.1 30.1 11.6 34 18 34z"/><path fill="#FBBC05" d="M8.6 20.8c-.3-1-.5-2-.5-3.1s.2-2.1.5-3.1l-.01-.2-5.2-4-.17.08C2.2 12.6 1.5 15.2 1.5 17.7s.7 5.1 1.9 7.3l5.2-4.2z"/><path fill="#EA4335" d="M18 8.6c3.1 0 5.2 1.3 6.4 2.4l4.6-4.5C26.1 3.9 22.4 2 18 2 11.6 2 6.1 5.9 3.4 11.5l5.2 4.1C9.9 11.6 13.6 8.6 18 8.6z"/></svg>',
  LinkedIn: '<svg viewBox="0 0 36 36" width="20" height="20"><rect width="36" height="36" rx="6" fill="#0A66C2"/><path fill="#fff" d="M11.5 14.6h4v11.6h-4zM13.5 9.4a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM18.5 14.6h3.8v1.6h.05c.53-.98 1.8-2 3.7-2 3.96 0 4.7 2.5 4.7 5.8v6.2h-4v-5.5c0-1.3 0-3-1.85-3s-2.13 1.4-2.13 2.9v5.6h-4z"/></svg>'
};
function renderPlataformas(porPlat, t, f) {
  const host = document.getElementById('plataformas');
  host.innerHTML = PLATS.map(p => {
    const d = porPlat[p], a = d.impr ? alcancePlat(f, p) : null;
    const semVeiculacao = !d.impr;
    const n = CAMP.filter(c => c.plataforma === p).length;
    const extra = p === 'Google'
      ? `<div><span class="r">Alcance</span><span class="v pend">só impressões</span></div><div><span class="r">Frequência</span><span class="v pend">não informada</span></div>`
      : `<div><span class="r">Alcance</span><span class="v">${a ? N(a.alcance) : (semVeiculacao ? '<span class="z">sem veiculação</span>' : PEND)}</span></div><div><span class="r">Frequência</span><span class="v">${a ? N1(a.freq) + '×' : (semVeiculacao ? '<span class="z">sem veiculação</span>' : PEND)}</span></div>`;
    const notaLinkedin = p === 'LinkedIn' && semVeiculacao
      ? `<div class="pend-nota"><span class="ms">info</span>LinkedIn ainda requer conexão: sem campanha registrada no período.</div>` : '';
    return `<div class="card"><div class="cab-plat">${ICONE_PLAT[p]}<h4>${p} Ads</h4><span class="share">${n} campanha${n === 1 ? '' : 's'}</span></div>
      <div class="mini">
        <div><span class="r">Investimento</span><span class="v">${BRL(d.inv)}<small>${t.inv ? Math.round(100 * d.inv / t.inv) + '% da verba' : ''}</small></span></div>
        <div><span class="r">Impressões</span><span class="v">${MI(d.impr)}<small>${t.impr ? Math.round(100 * d.impr / t.impr) + '%' : ''}</small></span></div>
        ${extra}
        <div><span class="r">Cliques</span><span class="v">${N(d.cli)}</span></div>
        <div><span class="r">CTR</span><span class="v">${PCT(d.ctr)}</span></div>
        <div><span class="r">CPM</span><span class="v">${BRL2(d.cpm)}</span></div>
        <div><span class="r">CPC</span><span class="v">${BRL2(d.cpc)}</span></div>
      </div>${notaLinkedin}</div>`;
  }).join('');
  document.getElementById('shareInv').innerHTML = stack(PLATS.map(p => ({ rot: p, v: porPlat[p].inv, cor: COR[p] })), t.inv);
  document.getElementById('shareImpr').innerHTML = stack(PLATS.map(p => ({ rot: p, v: porPlat[p].impr, cor: COR[p] })), t.impr);
}

function renderEvolucao() {
  const host = document.getElementById('pEvolucao');
  host.innerHTML = '';
  if (!SERIE.length) { host.innerHTML = '<div class="vazio">Sem dado no período</div>'; return; }
  // semanas (segunda a domingo) dentro do período
  const semanaDe = iso => { const d = new Date(iso + 'T12:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10); };
  const buckets = {};
  SERIE.forEach(r => { const s = semanaDe(r.data); buckets[s] = buckets[s] || { Institucional: 0, Cursos: 0, 'Organizações': 0 }; buckets[s][r.eixo] += Number(r.investimento) || 0; });
  const semanas = Object.keys(buckets).sort();
  const poucos = semanas.length < 2;
  if (poucos) {
    // menos de duas semanas: mostra por dia
    const dias = {}; SERIE.forEach(r => { dias[r.data] = dias[r.data] || { Institucional: 0, Cursos: 0, 'Organizações': 0 }; dias[r.data][r.eixo] += Number(r.investimento) || 0; });
    const ks = Object.keys(dias).sort();
    if (ks.length < 2) { host.innerHTML = '<div class="vazio">Período curto demais para a curva</div>'; return; }
    desenhaLinha(host, ks, dias, 'dia');
    return;
  }
  desenhaLinha(host, semanas, buckets, 'semana');
}
function desenhaLinha(host, chaves, dados, unidade) {
  const series = EIXOS.map(e => ({ nome: e, valores: chaves.map(k => Math.round(dados[k][e])) }));
  const max = Math.max(1, ...series.flatMap(s => s.valores)) * 1.15;
  const passo = passoBonito(max / 4);
  const passos = []; for (let v = 0; v <= max; v += passo) passos.push(v);
  const n = chaves.length, mostrar = [];
  const salto = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += salto) mostrar.push(i); if (mostrar[mostrar.length - 1] !== n - 1) mostrar.push(n - 1);
  PaineisCommunitas.linha(host, { rotulos: chaves.map(brCurto), series, max: passos[passos.length - 1] || max, passos, mostrarRotulos: mostrar, sufixo: '', prefixoTooltip: unidade === 'semana' ? 'semana de ' : '' });
  document.getElementById('legEvolucao').innerHTML = EIXOS.map((e, i) => `<span><i style="background:${['#E56B39', '#1F6FD0', '#0E9E76'][i]}"></i>${e}</span>`).join('');
  document.getElementById('subEvolucao').textContent = 'Investimento por ' + unidade + ', em reais, por eixo';
}
function passoBonito(x) { const p = Math.pow(10, Math.floor(Math.log10(x || 1))); const r = x / p; return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p; }

// plano do período: soma das verbas mensais previstas, pró-rata pelos dias do mês dentro do período
function planoEixo(eixo) {
  let verba = 0, temPlano = false;
  PLANO.filter(p => p.eixo === eixo).forEach(p => {
    const mIni = p.mes, mFim = fimDoMes(p.mes);
    const fimP = periodo.fimPlano || periodo.fim;
    const a = mIni > periodo.ini ? mIni : periodo.ini, b = mFim < fimP ? mFim : fimP;
    if (a > b) return;
    temPlano = true;
    verba += Number(p.verba) * diasEntre(a, b) / diasEntre(mIni, mFim);
  });
  return { verba, temPlano };
}
function ritmo(inv, plano) {
  const hoje = hojeISO();
  const fimP = periodo.fimPlano || periodo.fim;
  const fimEfetivo = fimP < hoje ? fimP : hoje;
  const pctTempo = Math.min(100, 100 * diasEntre(periodo.ini, fimEfetivo) / diasEntre(periodo.ini, fimP));
  const pctVerba = plano ? 100 * inv / plano : 0;
  let cls = 'b-cinza', rot = 'sem verba prevista';
  if (plano) {
    const d = pctVerba - pctTempo;
    if (d < -20) { cls = 'b-verm'; rot = 'verba atrás do tempo'; }
    else if (d > 15) { cls = 'b-amar'; rot = 'acima do ritmo'; }
    else { cls = 'b-verde'; rot = 'no ritmo'; }
  }
  return { pctTempo, pctVerba, cls, rot };
}

function renderEixos(porEixo, f) {
  const host = document.getElementById('eixos');
  host.innerHTML = EIXOS.map(e => {
    const d = porEixo[e], rows = CAMP.filter(c => c.eixo === e);
    const pl = planoEixo(e), rt = ritmo(d.inv, pl.verba);
    const metaImpr = totais(rows.filter(r => r.plataforma === 'Meta')).impr;
    const aM = metaImpr ? alcancePlat(f, 'Meta', e) : null;
    const semMeta = !metaImpr;
    const porPlat = PLATS.map(p => ({ rot: p, v: totais(rows.filter(r => r.plataforma === p)).inv, cor: COR[p] }));
    const porPlatImpr = PLATS.map(p => ({ rot: p, v: totais(rows.filter(r => r.plataforma === p)).impr, cor: COR[p] }));
    const ads = anunciosPorEixo(f, e);
    return `<div class="card eixo">
      <div class="cab-eixo"><div><h4>${e}</h4><div class="obj">${OBJ[e]}</div></div><span class="badge ${rt.cls}">${rt.rot}</span></div>
      <div class="mini">
        <div><span class="r">Investimento</span><span class="v">${BRL(d.inv)}</span></div>
        <div><span class="r">Impressões</span><span class="v">${MI(d.impr)}</span></div>
        <div><span class="r">Cliques</span><span class="v">${N(d.cli)}</span></div>
        <div><span class="r">CTR</span><span class="v">${PCT(d.ctr)}</span></div>
        <div><span class="r">CPM</span><span class="v">${BRL2(d.cpm)}</span></div>
        <div><span class="r">Alcance Meta</span><span class="v">${aM ? N(aM.alcance) + '<small>' + N1(aM.freq) + '×</small>' : (semMeta ? '<span class="z">sem campanha Meta</span>' : PEND)}</span></div>
      </div>
      <div class="plano">
        <div class="lin"><span>Verba prevista no período</span><b>${pl.temPlano ? BRL(pl.verba) : '<span class="mu">sem plano</span>'}</b></div>
        <div class="lin"><span>Consumido</span><b>${BRL(d.inv)}${pl.verba ? ' <span class="mu">(' + Math.round(rt.pctVerba) + '%)</span>' : ''}</b></div>
        <div class="lin"><span>Saldo</span><b>${pl.verba ? BRL(pl.verba - d.inv) : '<span class="mu">n/d</span>'}</b></div>
        <div class="prog" style="position:relative"><i style="width:${Math.min(100, rt.pctVerba)}%;background:${COR_EIXO[e]}"></i><span class="marca-tempo" style="left:${rt.pctTempo}%" title="${Math.round(rt.pctTempo)}% do tempo"></span></div>
        <div class="lin"><span class="mu">${Math.round(rt.pctTempo)}% do tempo decorrido</span><span class="mu">${pl.verba ? Math.round(rt.pctVerba) + '% da verba' : ''}</span></div>
      </div>
      <div class="share-bar"><div class="rot"><span>Investimento por canal</span></div>${stack(porPlat, d.inv)}</div>
      <div class="share-bar"><div class="rot"><span>Impressões por canal</span></div>${stack(porPlatImpr, d.impr)}</div>
      <div style="overflow:auto"><table><thead><tr><th>Campanha</th><th>Invest.</th><th>Impr.</th><th>CTR</th><th>CPM</th><th>Freq.</th></tr></thead><tbody>
        ${rows.length ? rows.map(r => {
          const rCpm = r.impressoes ? 1000 * r.investimento / r.impressoes : 0;
          const aR = r.plataforma === 'Meta' ? alcancePlat(f, 'Meta', e) : (r.plataforma === 'LinkedIn' ? alcancePlat(f, 'LinkedIn') : null);
          return `<tr><td><span class="n1">${r.campanha}</span><span class="n2" style="font-size:11.5px;color:var(--mute);display:block">${r.plataforma}</span></td><td>${BRL(r.investimento)}</td><td>${N(r.impressoes)}</td><td>${PCT(r.impressoes ? 100 * r.cliques / r.impressoes : 0)}</td><td>${BRL2(rCpm)}</td><td>${aR ? N1(aR.freq) + '×' : '<span class="z">n/d</span>'}</td></tr>`;
        }).join('')
          : '<tr><td colspan="6" class="z">Sem campanha no período</td></tr>'}
      </tbody></table></div>
      <details class="anuncios-rec">
        <summary><span class="rot">Anúncios com mais impressões <small style="color:var(--mute)">Google por campanha; Meta pela conta (Certificação = Organizações)</small></span></summary>
        ${ads.length ? `<div style="overflow:auto;max-height:340px"><table class="tab-anuncios"><thead><tr><th class="nome">Anúncio</th><th>Impr.</th><th>Alcance</th><th>CTR</th><th>CPM</th><th>Freq.</th></tr></thead><tbody>
          ${ads.map(a => `<tr><td class="nome"><span class="n1">${a.nome}</span><span class="n2">${a.plat}</span></td><td>${N(a.impr)}</td><td>${a.alc ? N(a.alc) : '<span class="z">n/d</span>'}</td><td>${PCT(a.ctr)}</td><td>${BRL2(a.cpm)}</td><td>${a.alc && a.impr ? N1(a.impr / a.alc) + '×' : '<span class="z">n/d</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : `<div class="pend-nota"><span class="ms">info</span>Aguardando a foto de anúncios do Reportei para este período.</div>`}
      </details>
    </div>`;
  }).join('');
}

function renderVideos(f) {
  const host = document.getElementById('videos');
  // por canal: campanhas de vídeo em midia_diaria (investimento, impressões, cliques) + fotos (alcance, views)
  const canais = [
    { rot: 'Meta Ads', plat: 'Meta', fmt: 'vídeo no feed e stories' },
    { rot: 'LinkedIn Ads', plat: 'LinkedIn', fmt: 'sponsored video' },
    { rot: 'YouTube (Google Ads)', plat: 'Google', fmt: 'in-stream' }
  ];
  let h = `<table><thead><tr><th>Canal</th><th>Campanhas</th><th>Investido</th><th>Impressões</th><th>Alcance</th><th>Visualizações</th><th>Conclusões</th><th>CTR</th><th>CPM</th></tr></thead><tbody>`;
  let algum = false;
  canais.forEach(c => {
    const rows = CAMP.filter(r => r.plataforma === c.plat && ehVideo(r.campanha));
    const t = totais(rows);
    if (rows.length) algum = true;
    const L = f.linhas.filter(r => r.plataforma === c.plat);
    let alc = null, views = null, compl = null;
    if (c.plat === 'Meta') {
      const cam = L.filter(r => r.nivel === 'campanha' && ehVideo(r.nome) && ehInstitucional(r.nome));
      alc = somaM(cam, 'alcance') || null;
      const thru = cam.filter(r => /thruplay/i.test(r.m.resultado_tipo || ''));
      compl = thru.length ? somaM(thru, 'resultados') : null;
    } else if (c.plat === 'LinkedIn') {
      const cta = L.filter(r => r.nivel === 'conta');
      views = somaM(cta, 'video_views') || null; compl = somaM(cta, 'video_completions') || null;
    } else {
      const vid = L.filter(r => r.nivel === 'video');
      views = somaM(vid, 'video_views') || null;
    }
    h += `<tr><td><b>${c.rot}</b><span style="display:block;font-size:11.5px;color:var(--mute)">${c.fmt}</span></td><td>${rows.length}</td><td>${BRL(t.inv)}</td><td>${N(t.impr)}</td>
      <td>${alc ? N(alc) : '<span class="z">n/d</span>'}</td><td>${views ? N(views) : '<span class="z">n/d</span>'}</td>
      <td>${compl ? N(compl) + (t.impr ? ' <small style="color:var(--mute)">' + PCT(100 * compl / t.impr, 1) + '</small>' : '') : '<span class="z">n/d</span>'}</td>
      <td>${PCT(t.ctr)}</td><td>${BRL2(t.cpm)}</td></tr>`;
  });
  h += '</tbody></table>';
  if (!algum) h = '<div class="vazio">Sem campanha de vídeo com mídia no período</div>';
  host.innerHTML = h;

  // por criativo (fotos): anúncios de vídeo do Meta e vídeos do YouTube
  const cri = f.linhas.filter(r => (r.nivel === 'anuncio' && r.plataforma === 'Meta' && ehVideo(r.nome)) || (r.nivel === 'video' && r.plataforma === 'Google'))
    .map(r => ({ plat: r.plataforma === 'Google' ? 'YouTube' : 'Meta', nome: r.nome, inv: Number(r.m.investimento) || 0, impr: Number(r.m.impressoes) || 0, alc: Number(r.m.alcance) || 0,
      views: Number(r.m.video_views) || 0, rate: Number(r.m.view_rate) || 0, ctr: Number(r.m.ctr) || 0, cpm: Number(r.m.cpm) || 0 }))
    .sort((a, b) => b.impr - a.impr).slice(0, 12);
  const host2 = document.getElementById('criativos');
  host2.innerHTML = cri.length
    ? `<table class="tab-anuncios"><thead><tr><th class="nome">Criativo</th><th>Investido</th><th>Impressões</th><th>Alcance</th><th>Views</th><th>CTR</th><th>CPM</th></tr></thead><tbody>
      ${cri.map(a => `<tr><td class="nome"><span class="n1">${a.nome}</span><span class="n2">${a.plat}</span></td><td>${a.inv ? BRL(a.inv) : '<span class="z">n/d</span>'}</td><td>${N(a.impr)}</td><td>${a.alc ? N(a.alc) : '<span class="z">n/d</span>'}</td><td>${a.views ? N(a.views) + (a.rate ? ' <small style="color:var(--mute)">' + PCT(a.rate, 1) + '</small>' : '') : '<span class="z">n/d</span>'}</td><td>${a.ctr ? PCT(a.ctr) : '<span class="z">n/d</span>'}</td><td>${a.cpm ? BRL2(a.cpm) : '<span class="z">n/d</span>'}</td></tr>`).join('')}
    </tbody></table>`
    : '<div class="pend-nota"><span class="ms">info</span>Aguardando a foto de criativos do Reportei para este período.</div>';
}

function renderTrafego(f) {
  const props = f.linhas.filter(r => r.plataforma === 'GA4' && r.nivel === 'propriedade');
  const site = props.filter(r => /site|org\.br/i.test(r.nome)), lps = props.filter(r => /lp/i.test(r.nome));
  const sc = f.linhas.filter(r => r.plataforma === 'SearchConsole');
  const marca = sc.filter(r => r.nivel === 'consulta' && r.m.marca);
  const eng = somaM(site, 'engajamentos') || somaM(site, 'sessoes_engajadas');
  const k = [];
  k.push(kpi('language', 'roxo', 'Sessões pagas no site', site.length ? N(somaM(site, 'sessoes_pagas')) : null, site.length ? 'vanzolini.org.br, tráfego pago (GA4)' : 'aguardando foto do GA4', !site.length));
  k.push(kpi('language', 'azul', 'Sessões pagas nas LPs', lps.length ? N(somaM(lps, 'sessoes_pagas')) : null, lps.length ? 'LPs de conteúdo, tráfego pago (GA4)' : 'aguardando foto do GA4', !lps.length));
  k.push(kpi('search', 'laranja', 'Busca pela marca', marca.length ? N(somaM(marca, 'cliques')) : null, marca.length ? 'cliques em buscas com "vanzolini" (Search Console)' : 'aguardando foto do Search Console', !marca.length));
  k.push(kpi('trending_up', 'verde', 'Engajamento no site', eng ? N(eng) : null, eng ? 'sessões engajadas, tráfego pago (GA4)' : 'aguardando foto do GA4', !eng));
  document.getElementById('kpisTrafego').innerHTML = k.join('');
}

function renderRodape(f) {
  const ultimaFoto = REP.reduce((a, r) => r.carregado_em > a ? r.carregado_em : a, '');
  document.getElementById('rodapeTxt').innerHTML =
    `<b>Fontes.</b> Investimento, impressões e cliques: planilha Campanhas_Vanzolini_Consolidado carregada no Supabase às 6h e às 18h` + (MIDIA_ATE ? `, dados até <b>${br(MIDIA_ATE)}</b>` : '') + `. ` +
    `Alcance, frequência, vídeos, anúncios, GA4 e busca: fotos do Reportei` + (ultimaFoto ? `, última em <b>${new Date(ultimaFoto).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</b>` : '') + `. ` +
    `CTR, CPM e CPC calculados dos totais. Eixo definido pelo nome da campanha. Google Ads não informa alcance nem frequência, por isso o consolidado de alcance soma Meta e LinkedIn.` +
    ` Consultado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
}

// ---------- início ----------
window.iniciarPainel = async function () {
  try {
    montarFiltros();
    await carregarBase();
    const p = presetsPeriodo()[0];
    await aplicar(p.ini, p.fim, 'mes');
  } catch (e) {
    document.getElementById('leituraTxt').innerHTML = 'Erro ao carregar: ' + e.message;
    if (window.Dash) Dash.tag('<b>erro de conexão</b>', 'erro');
  }
};
