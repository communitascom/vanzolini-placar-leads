// Logica compartilhada por campanhas.html (interno) e cliente-campanhas.html
// (versao do cliente, com PIN e sem os alertas operacionais).
//
// As duas paginas usam ESTE arquivo de proposito. Uma copia congelada foi
// exatamente o que fez o historico estatico divergir do banco por dois meses.
//
// O que muda entre as versoes vem do proprio DOM, sem flag espalhada pelo codigo:
//   - se a pagina nao tem #sec-alertas, os alertas nao sao buscados nem exibidos
//   - se a pagina define window.AGUARDA_PIN, o carregar() nao dispara sozinho

const SUPABASE_URL = "https://ltasijrhkotyyrxnavab.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YXNpanJoa290eXlyeG5hdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk5NDAsImV4cCI6MjA5NjcwNTk0MH0.XAJmbTSm6d5Y6xobOLceHlVr0e_iratHW_u6atzUC5c";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MONDAY_BOARD = "935301050";

const N = v => Number(v||0).toLocaleString('pt-BR');
const BRL = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
const BRL2 = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const PCT = v => (v===null||v===undefined) ? '<span class="z">—</span>' : Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const NAVY='#060653', AZUL='#4848B5', CINZA='#c9c9ee', VERDE='#2e9e5b';
let CAMP=[], RITMO=[], CURVA=[], MIDIA=[], ALERTAS=[], MIDIA_ATE=null, charts={};
Chart.register(ChartDataLabels);
Chart.defaults.plugins.datalabels.display = false;

const temAlertas = () => !!document.getElementById('sec-alertas');

function mkChart(id,type,data,opts){
  if(charts[id]) charts[id].destroy();
  charts[id]=new Chart(document.getElementById(id),{type,data,options:Object.assign({responsive:true,maintainAspectRatio:false},opts)});
}

function selo(v){
  if(v===null||v===undefined) return '<span class="z">sem base</span>';
  const n=Number(v);
  const cls = n>=10?'b-verde' : n<=-15?'b-verm' : 'b-amar';
  return `<span class="badge ${cls}">${n>=0?'+':''}${n}%</span>`;
}

function render(){
  const totLeads = CAMP.reduce((a,c)=>a+Number(c.leads||0),0);
  const totVerba = CAMP.reduce((a,c)=>a+Number(c.verba||0),0);
  const totGasto = CAMP.reduce((a,c)=>a+Number(c.gasto||0),0);
  const totProj  = CAMP.reduce((a,c)=>a+Number(c.proj_leads||0),0);
  const cplMedio = totLeads ? totGasto/totLeads : 0;
  const pctGasto = totVerba ? 100*totGasto/totVerba : 0;

  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="v">${CAMP.length}</div><div class="l">Campanhas no ar</div><div class="s">${CAMP.filter(c=>c.proj_leads).length} com projeção</div></div>
    <div class="kpi"><div class="v">${N(totLeads)}</div><div class="l">Leads captados</div><div class="s">projeção de ${N(totProj)} no fechamento</div></div>
    <div class="kpi"><div class="v">${BRL(totGasto)}</div><div class="l">Verba investida</div><div class="s">${pctGasto.toFixed(1)}% de ${BRL(totVerba)}</div></div>
    <div class="kpi"><div class="v">${BRL(totVerba-totGasto)}</div><div class="l">Verba a investir</div><div class="s">saldo das campanhas no ar</div></div>
    <div class="kpi"><div class="v">${BRL2(cplMedio)}</div><div class="l">CPL médio</div><div class="s">custo por lead no período</div></div>`;

  // Aviso de defasagem da midia. Aparece nas duas versoes: nao e um alerta
  // operacional, e a honestidade sobre ate quando o numero de verba vale.
  // Sem ele, verba atrasada na planilha parece subinvestimento.
  let aviso = '';
  if(MIDIA_ATE){
    const diasAtras = Math.round((new Date().setHours(0,0,0,0) - new Date(MIDIA_ATE+'T00:00:00').getTime())/86400000);
    if(diasAtras > 1) aviso = `<div class="avisodef"><span class="material-symbols-outlined" style="font-size:15px">warning</span> Os dados de mídia (verba, CTR, CPL) vão até <b>${MIDIA_ATE.slice(8,10)}/${MIDIA_ATE.slice(5,7)}</b>, ou seja, ${diasAtras} dias atrás. A carga roda sozinha às 6h e às 18h, então esse atraso vem da própria planilha, não do placar: parte do gasto pode ser lançamento que ainda não chegou lá, não subinvestimento real. Os leads estão ao vivo.</div>`;
  }
  const boxAviso = document.getElementById('aviso-midia');
  if(boxAviso) boxAviso.innerHTML = aviso;

  // Alertas operacionais: so na versao interna.
  const sec = document.getElementById('sec-alertas');
  if(sec){
    sec.style.display = 'block';
    document.getElementById('alertas').innerHTML = ALERTAS.length
      ? ALERTAS.map(a=>`
        <div class="alerta ${a.severidade}">
          <span class="ico material-symbols-outlined">${a.tipo_alerta==='verba'?'payments':'trending_down'}</span>
          <div><b>${a.curso}</b><br><span class="txt">${a.detalhe}</span></div>
        </div>`).join('')
      : '<div class="alerta full" style="border-left-color:var(--verde);background:var(--verde-bg)"><span class="ico material-symbols-outlined">check_circle</span><div><b>Nenhuma campanha fora do padrão</b><br><span class="txt">captação e ritmo de verba dentro do esperado</span></div></div>';
  }

  // tabela principal
  let h = `<table><thead><tr>
    <th>Curso</th><th>Período</th><th>Tempo</th><th>Leads</th><th>Projeção</th>
    <th>Faixa</th><th>Histórico</th><th>vs hist.</th>
    <th>Verba</th><th>Gasto</th><th>Investir/dia</th><th>CTR</th><th>CPL</th>
  </tr></thead><tbody>`;
  CAMP.forEach(c=>{
    const pctT = Number(c.pct_tempo||0), pctG = Number(c.pct_gasto||0);
    const barra = `<div class="barra"><span class="t" style="width:${Math.min(100,pctT)}%"></span><span class="g" style="width:${Math.min(100,pctG)}%;opacity:.85"></span></div>`;
    const nome = c.monday_item_id
      ? `<a href="https://communitascom.monday.com/boards/${MONDAY_BOARD}/pulses/${c.monday_item_id}" target="_blank" rel="noopener" style="color:var(--navy);font-weight:600;text-decoration:none">${c.curso}</a>`
      : `<b>${c.curso}</b>`;
    h += `<tr>
      <td>${nome}</td>
      <td style="font-size:11px;color:var(--mut)">${c.data_inicio.slice(8,10)}/${c.data_inicio.slice(5,7)} a ${c.data_fim.slice(8,10)}/${c.data_fim.slice(5,7)}<br>${c.dias_restantes} dias restantes</td>
      <td>${PCT(c.pct_tempo)}<br><span class="leg">${c.dias_decorridos}/${c.dias_total} dias</span></td>
      <td><b>${N(c.leads)}</b></td>
      <td>${c.proj_leads?'<b>'+N(c.proj_leads)+'</b>':'<span class="z">cedo</span>'}</td>
      <td style="font-size:11px;color:var(--mut)">${c.proj_min?N(c.proj_min)+' a '+N(c.proj_max):'—'}</td>
      <td>${c.mediana_historica?N(c.mediana_historica)+'<span class="leg">'+c.turmas_base+' turma(s)</span>':'<span class="z">—</span>'}</td>
      <td>${selo(c.vs_historico)}</td>
      <td>${c.verba?BRL(c.verba):'<span class="z">—</span>'}</td>
      <td>${BRL(c.gasto)}<br>${barra}<span class="leg">${pctG.toFixed(0)}% da verba</span></td>
      <td>${c.investir_por_dia?BRL2(c.investir_por_dia):'<span class="z">—</span>'}</td>
      <td>${c.ctr?Number(c.ctr).toFixed(2)+'%':'<span class="z">—</span>'}</td>
      <td>${c.cpl?BRL2(c.cpl):'<span class="z">—</span>'}</td>
    </tr>`;
  });
  h += '</tbody></table>';
  document.getElementById('t-camp').innerHTML = h;

  // grafico de verba: tempo x gasto
  const ord = [...CAMP].sort((a,b)=>Number(b.verba||0)-Number(a.verba||0));
  mkChart('c-verba','bar',{
    labels: ord.map(c=>c.curso.length>34?c.curso.slice(0,34)+'…':c.curso),
    datasets:[
      {label:'% do tempo decorrido', data:ord.map(c=>Number(c.pct_tempo||0)), backgroundColor:CINZA,
        datalabels:{display:true,color:'#5F5E76',anchor:'end',align:'end',font:{size:9,weight:600},formatter:v=>v.toFixed(0)+'%'}},
      {label:'% da verba gasta', data:ord.map(c=>Number(c.pct_gasto||0)), backgroundColor:AZUL,
        datalabels:{display:true,color:'#fff',anchor:'end',align:'start',font:{size:9,weight:600},formatter:v=>v.toFixed(0)+'%'}}
    ]},
    {indexAxis:'y', plugins:{legend:{display:true,labels:{font:{size:10},boxWidth:12}}},
     scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'}},y:{ticks:{font:{size:10}}}}});

  // CTR por plataforma
  const porPlat = {};
  MIDIA.forEach(m=>{
    const p = m.plataforma;
    porPlat[p] = porPlat[p] || {impr:0, cliq:0, inv:0, cursos:new Set()};
    porPlat[p].impr += Number(m.impressoes||0);
    porPlat[p].cliq += Number(m.cliques||0);
    porPlat[p].inv  += Number(m.investimento||0);
    if(m.curso) porPlat[p].cursos.add(m.curso);
  });
  let hc = `<table><thead><tr><th>Plataforma</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>CPC</th><th>Investimento</th><th>Cursos</th></tr></thead><tbody>`;
  Object.keys(porPlat).sort((a,b)=>porPlat[b].inv-porPlat[a].inv).forEach(p=>{
    const d = porPlat[p];
    const ctr = d.impr ? 100*d.cliq/d.impr : 0;
    hc += `<tr><td><b>${p}</b></td><td>${N(d.impr)}</td><td>${N(d.cliq)}</td>
      <td><b>${ctr.toFixed(2)}%</b></td><td>${d.cliq?BRL2(d.inv/d.cliq):'—'}</td>
      <td>${BRL(d.inv)}</td><td>${d.cursos.size}</td></tr>`;
  });
  hc += '</tbody></table>';
  document.getElementById('t-ctr').innerHTML = hc;

  // seletor da curva
  const sel = document.getElementById('f-camp');
  sel.innerHTML = CAMP.map(c=>`<option value="${c.curso.replace(/"/g,'&quot;')}">${c.curso}</option>`).join('');
  sel.onchange = ()=>desenhaCurva(sel.value);
  if(CAMP.length) desenhaCurva(CAMP[0].curso);
}

function desenhaCurva(curso){
  const c = CAMP.find(x=>x.curso===curso);
  const serie = RITMO.filter(r=>r.curso===curso);
  if(!c || !serie.length) return;

  const labels = serie.map(r=>r.dia.slice(8,10)+'/'+r.dia.slice(5,7));
  const real = serie.map(r=>Number(r.leads_acum));
  const esperado = serie.map(r=>r.esperado_acum===null?null:Number(r.esperado_acum));

  // projecao para frente: da curva historica, dos bins ainda nao alcancados
  const pctAtual = Number(c.pct_tempo);
  const futuros = CURVA.filter(x=>Number(x.pct_tempo) > pctAtual);
  const labelsFut = futuros.map(x=>'+'+x.pct_tempo+'% tempo');
  const projFut = futuros.map(x=> c.proj_leads ? Math.round(c.proj_leads*Number(x.pct_leads_mediana)/100) : null);
  const projMin = futuros.map(x=> c.proj_min ? Math.round(c.proj_min*Number(x.pct_leads_mediana)/100) : null);
  const projMax = futuros.map(x=> c.proj_max ? Math.round(c.proj_max*Number(x.pct_leads_mediana)/100) : null);
  const nR = real.length;
  const vazio = new Array(nR-1).fill(null);

  document.getElementById('hint-curva').innerHTML =
    `<b>${c.curso}</b>: ${N(c.leads)} leads em ${c.dias_decorridos} de ${c.dias_total} dias (${PCT(c.pct_tempo)} do tempo). ` +
    (c.proj_leads
      ? `Projeção de <b>${N(c.proj_leads)}</b> no fechamento, faixa provável de ${N(c.proj_min)} a ${N(c.proj_max)}. `
      : 'Ainda cedo para projetar. ') +
    `A linha esperada é ancorada no ponto de hoje, então ela sempre encosta no real agora: o que informa é o caminho antes e a projeção depois.`;

  mkChart('c-curva','line',{
    labels: labels.concat(labelsFut),
    datasets:[
      {label:'Leads acumulados (real)', data:real, borderColor:NAVY, backgroundColor:'rgba(72,72,181,.10)', fill:true, tension:.25, borderWidth:3, pointRadius:0},
      {label:'Caminho esperado', data:esperado, borderColor:CINZA, borderDash:[6,4], tension:.25, borderWidth:2, pointRadius:0},
      {label:'Projeção', data:vazio.concat([real[nR-1]]).concat(projFut), borderColor:VERDE, borderDash:[3,3], tension:.25, borderWidth:2, pointRadius:0},
      {label:'Faixa otimista', data:vazio.concat([real[nR-1]]).concat(projMax), borderColor:'rgba(46,158,91,.35)', tension:.25, borderWidth:1, pointRadius:0},
      {label:'Faixa conservadora', data:vazio.concat([real[nR-1]]).concat(projMin), borderColor:'rgba(46,158,91,.35)', tension:.25, borderWidth:1, pointRadius:0}
    ]},
    {plugins:{legend:{display:true,labels:{font:{size:10},boxWidth:14}}},
     scales:{y:{beginAtZero:true,title:{display:true,text:'leads acumulados'}},
             x:{ticks:{font:{size:9},maxRotation:60,minRotation:0,autoSkip:true,maxTicksLimit:20}}}});
}

const btnImprimir = document.getElementById('imprimir');
if(btnImprimir) btnImprimir.onclick = ()=>{
  document.getElementById('ph-titulo').textContent = 'Campanhas em andamento · Fundação Vanzolini';
  document.getElementById('ph-sub').textContent = 'gerado em ' + new Date().toLocaleString('pt-BR');
  window.print();
};

async function carregar(){
  const hoje = new Date().toISOString().slice(0,10);
  const ini = new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  const comAlertas = temAlertas();

  const chamadas = [
    sb.rpc('campanhas_andamento'),
    sb.rpc('ritmo_diario'),
    sb.rpc('curva_ritmo'),
    sb.rpc('midia_por_curso',{p_inicio:ini,p_fim:hoje}),
    sb.rpc('midia_atualizada_ate')
  ];
  // Na versao do cliente o alerta nem e buscado: o dado nao chega ao navegador.
  if(comAlertas) chamadas.push(sb.rpc('alertas_captacao'));

  const res = await Promise.all(chamadas);
  const [a,b,c,d,f] = res;
  const e = comAlertas ? res[5] : {data:[], error:null};

  const erro = a.error||b.error||c.error||d.error||f.error||e.error;
  if(erro){
    document.getElementById('kpis').innerHTML =
      `<div class="kpi"><div class="v" style="font-size:15px;color:#d64545">Erro ao carregar</div><div class="l">${erro.message}</div></div>`;
    return;
  }
  CAMP=a.data; RITMO=b.data; CURVA=c.data; MIDIA=d.data; ALERTAS=e.data||[];
  MIDIA_ATE = f.data || null;
  document.getElementById('rodape').innerHTML =
    `Leitura ao vivo · leads pela regra anti-refire de 90 dias · mídia da planilha Campanhas_Vanzolini_Consolidado${MIDIA_ATE?' (até '+MIDIA_ATE.split('-').reverse().join('/')+')':''}, carga automática às 6h e às 18h · CTR calculado, nunca importado · consultado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  render();
}

if(!window.AGUARDA_PIN) carregar();
