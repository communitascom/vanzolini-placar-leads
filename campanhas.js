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
const NAVY='#E56B39', AZUL='#1F6FD0', CINZA='#C5CAD3', VERDE='#0E9E76'; // paleta Painéis Communitas
// CAMP traz o que esta no ar e o que encerrou nos ultimos 7 dias. Tudo que fala
// de "no ar" usa NOAR; as encerradas ganham um quadro proprio, porque quem
// estoura a verba encerrava e sumia da tela justo quando dava para aprender.
let CAMP=[], NOAR=[], FIM=[], RITMO=[], CURVA=[], MIDIA=[], ALERTAS=[], MIDIA_ATE=null, charts={};
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
  const totLeads = NOAR.reduce((a,c)=>a+Number(c.leads||0),0);
  const totVerba = NOAR.reduce((a,c)=>a+Number(c.verba||0),0);
  const totGasto = NOAR.reduce((a,c)=>a+Number(c.gasto||0),0);
  const totProj  = NOAR.reduce((a,c)=>a+Number(c.proj_leads||0),0);
  const cplMedio = totLeads ? totGasto/totLeads : 0;
  const pctGasto = totVerba ? 100*totGasto/totVerba : 0;

  const K = window.Dash && Dash.kpi;
  document.getElementById('kpis').innerHTML = K
    ? K('campaign','azul','Campanhas no ar', NOAR.length, NOAR.filter(c=>c.proj_leads).length+' com projeção') +
      K('group','laranja','Leads captados', N(totLeads), 'projeção de '+N(totProj)+' no fechamento') +
      K('payments','roxo','Verba investida', BRL(totGasto), pctGasto.toFixed(1)+'% de '+BRL(totVerba)) +
      K('account_balance_wallet','verde','Verba a investir', BRL(totVerba-totGasto), 'saldo das campanhas no ar') +
      K('sell','amarelo','CPL médio', BRL2(cplMedio), 'custo por lead no período')
    : '';

  // Aviso de defasagem da midia. Nao e alerta operacional, e a honestidade sobre
  // ate quando o numero de verba vale. Sem ele, verba atrasada parece
  // subinvestimento.
  //
  // A regua nao e "mais de um dia". Medido em 07/09/2026 sobre 20 dias de carga:
  // o dado do dia D entra sempre na carga das 18h do dia D+1 (a das 6h nunca
  // traz dia novo, so corrige o que ja esta la). Entao, antes das 18h, estar
  // dois dias atras e o normal do desenho, nao defeito. Avisar ali era alarme
  // falso metade de todo dia, e alarme falso ensina a ignorar o aviso.
  let aviso = '';
  if(MIDIA_ATE){
    const diasAtras = Math.round((new Date().setHours(0,0,0,0) - new Date(MIDIA_ATE+'T00:00:00').getTime())/86400000);
    const normal = new Date().getHours() >= 18 ? 1 : 2;
    if(diasAtras > normal) aviso = `<div class="avisodef"><span class="material-symbols-outlined" style="font-size:15px">warning</span> Os dados de mídia (verba, CTR, CPL) vão até <b>${MIDIA_ATE.slice(8,10)}/${MIDIA_ATE.slice(5,7)}</b>, ${diasAtras} dias atrás, acima do normal, que é ${normal}. A carga roda sozinha às 6h e às 18h e o atraso vem da própria planilha, não do placar: parte do gasto pode ser lançamento que ainda não chegou lá, não subinvestimento real. Os leads estão ao vivo.</div>`;
  }
  const boxAviso = document.getElementById('aviso-midia');
  if(boxAviso) boxAviso.innerHTML = aviso;

  // Alertas operacionais: so na versao interna.
  const sec = document.getElementById('sec-alertas');
  if(sec){
    sec.style.display = 'block';
    document.getElementById('alertas').innerHTML = ALERTAS.length
      ? ALERTAS.map(a=>{
        const verba = a.tipo_alerta==='verba';
        return `<div class="alerta ${a.severidade}">
          <div class="al-topo">
            <span class="al-tag ${verba?'t-verba':'t-leads'}">${verba?'verba':'leads'}</span>
            <span class="ico material-symbols-outlined">${verba?'payments':'trending_down'}</span>
          </div>
          <b>${a.curso}</b><span class="txt">${a.detalhe}</span>
        </div>`;}).join('')
      : '<div class="alerta full ok"><div class="al-topo"><span class="al-tag t-ok">tudo certo</span><span class="ico material-symbols-outlined">check_circle</span></div><b>Nenhuma campanha fora do padrão</b><span class="txt">captação e ritmo de verba dentro do esperado</span></div>';
  }

  // tabela principal
  //
  // Enxugada de 13 para 9 colunas em 07/09: o periodo virou segunda linha do
  // curso, CTR e CPL dividem uma coluna, "Faixa" saiu (agora vive na caixa
  // abaixo da curva) e a mediana historica crua saiu tambem — o que informa e a
  // comparacao (vs hist.), nao o numero de referencia. Com 13 colunas a tabela
  // so era legivel rolando de lado.
  // Ordem alfabetica, nao por verba: quem procura um curso na tabela procura
  // pelo nome. A ordem por verba servia a uma pergunta que os indicadores do
  // topo ja respondem.
  const ordenadas = NOAR.slice().sort((a,b)=>
    String(a.curso||'').localeCompare(String(b.curso||''), 'pt-BR'));

  const grupos = {
    todas:  ()=>true,
    mba:    c=>c.tipo==='MBA',
    curso:  c=>c.tipo!=='MBA',
    atras:  c=>c.verba && Number(c.pct_gasto) < Number(c.pct_tempo) - 20,
    abaixo: c=>Number(c.vs_historico) <= -15
  };
  const rotulos = {todas:'Todas', mba:'MBA', curso:'Cursos', atras:'Verba atrás', abaixo:'Abaixo do histórico'};
  const barraF = document.getElementById('f-noar');
  if(barraF){
    barraF.innerHTML = Object.keys(grupos).map(id=>{
      const n = ordenadas.filter(grupos[id]).length;
      return n ? `<button class="chip${filtroNoar===id?' on':''}" data-f="${id}">${rotulos[id]} <b>${n}</b></button>` : '';
    }).join('');
    barraF.querySelectorAll('button').forEach(b=>b.onclick=()=>{ filtroNoar=b.dataset.f; render(); });
  }
  const visiveis = ordenadas.filter(grupos[filtroNoar] || grupos.todas);

  let h = `<table class="t-compacta"><thead><tr>
    <th class="nome">Curso</th><th>Tempo</th><th>Leads</th><th>Projeção</th><th>vs hist.</th>
    <th>Verba</th><th>Gasto</th><th>Investir<br>/dia</th><th>CTR<br>CPL</th>
  </tr></thead><tbody>`;
  visiveis.forEach(c=>{
    const pctT = Number(c.pct_tempo||0), pctG = Number(c.pct_gasto||0);
    // A barra so vai ate 100% por limite visual, entao o estouro precisa aparecer
    // pela cor e pelo rotulo, senao some da tela.
    const estourou = pctG > 100;
    const barra = `<div class="barra"><span class="t" style="width:${Math.min(100,pctT)}%"></span>`
      + `<span class="g" style="width:${Math.min(100,pctG)}%;opacity:.85${estourou?';background:#D64545':''}"></span></div>`
      + (estourou ? `<div style="font-size:10px;color:#D64545;font-weight:600;margin-top:2px">estourada · ${pctG.toFixed(0)}%</div>` : '');
    const nome = c.monday_item_id
      ? `<a href="https://communitascom.monday.com/boards/${MONDAY_BOARD}/pulses/${c.monday_item_id}" target="_blank" rel="noopener">${c.curso}</a>`
      : c.curso;
    h += `<tr>
      <td class="nome"><span class="n1">${nome}</span><span class="n2">${c.data_inicio.slice(8,10)}/${c.data_inicio.slice(5,7)} a ${c.data_fim.slice(8,10)}/${c.data_fim.slice(5,7)} · ${c.dias_restantes} dias restantes</span></td>
      <td>${PCT(c.pct_tempo)}<span class="leg">${c.dias_decorridos}/${c.dias_total} dias</span></td>
      <td class="destaque">${N(c.leads)}</td>
      <td>${(()=>{const r=projeta(c); return r?'<b>'+N(r.trabalho)+'</b>':'<span class="z">—</span>';})()}</td>
      <td>${selo(c.vs_historico)}</td>
      <td>${c.verba?BRL(c.verba):'<span class="z">—</span>'}</td>
      <td class="c-gasto"><span class="g-val">${BRL(c.gasto)}</span>${barra}<span class="leg">${pctG.toFixed(0)}% da verba</span></td>
      <td>${c.investir_por_dia?BRL2(c.investir_por_dia):'<span class="z">—</span>'}</td>
      <td>${c.ctr?Number(c.ctr).toFixed(2)+'%':'<span class="z">—</span>'}<span class="leg">${c.cpl?BRL2(c.cpl):'—'}</span></td>
    </tr>`;
  });
  h += '</tbody></table>';
  document.getElementById('t-camp').innerHTML = visiveis.length ? h
    : '<div class="empty">Nenhuma campanha neste filtro.</div>';

  // recem-encerradas: janela de 7 dias
  const hostFim = document.getElementById('t-encerradas');
  const secFim = document.getElementById('sec-encerradas');
  if(hostFim && secFim){
    secFim.style.display = FIM.length ? 'flex' : 'none';
    document.getElementById('n-encerradas').textContent = FIM.length;
    hostFim.innerHTML = FIM.length ? `<table class="t-compacta"><thead><tr>
      <th class="nome">Curso</th><th>Encerrou</th><th>Leads</th><th>vs hist.</th><th>Verba</th><th>Gasto</th><th>CTR<br>CPL</th>
    </tr></thead><tbody>` + FIM.map(c=>{
      const pctG = Number(c.pct_gasto||0), estourou = pctG > 100;
      return `<tr>
        <td class="nome"><span class="n1">${c.curso}</span><span class="n2">${c.data_inicio.slice(8,10)}/${c.data_inicio.slice(5,7)} a ${c.data_fim.slice(8,10)}/${c.data_fim.slice(5,7)} · ${c.dias_total} dias</span></td>
        <td>há ${c.dias_desde_fim} dia${c.dias_desde_fim===1?'':'s'}</td>
        <td class="destaque">${N(c.leads)}</td>
        <td>${selo(c.vs_historico)}</td>
        <td>${c.verba?BRL(c.verba):'<span class="z">—</span>'}</td>
        <td>${BRL(c.gasto)}<span class="leg" style="${estourou?'color:#D64545;font-weight:600':''}">${c.pct_gasto?pctG.toFixed(0)+'% da verba':'—'}</span></td>
        <td>${c.ctr?Number(c.ctr).toFixed(2)+'%':'<span class="z">—</span>'}<span class="leg">${c.cpl?BRL2(c.cpl):'—'}</span></td>
      </tr>`;
    }).join('') + '</tbody></table>' : '';
  }

  // Tempo decorrido x verba investida.
  //
  // Era um grafico de barras agrupadas, duas barras por campanha, e ninguem
  // conseguia ler: a pergunta e "a verba esta acompanhando o tempo?", que e uma
  // comparacao dentro da campanha, e barras lado a lado empurram o olho a
  // comparar campanhas entre si. Virou uma lista: um trilho por campanha, a
  // barra e a verba, o risco vertical e o tempo, e a distancia entre os dois e
  // a resposta. Ordenado pelo maior descompasso, que e o que pede acao.
  renderVerba();

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
  sel.innerHTML = NOAR.map(c=>`<option value="${c.curso.replace(/"/g,'&quot;')}">${c.curso}</option>`).join('');
  sel.onchange = ()=>desenhaCurva(sel.value);
  if(NOAR.length) desenhaCurva(NOAR[0].curso);
}

let filtroNoar = 'todas';
let filtroVerba = 'todas';
function classeVerba(gap, pctG){
  if(pctG > 100) return {cls:'estourou', rot:'verba estourada'};
  if(gap <= -15) return {cls:'atrasada', rot:'verba atrás do tempo'};
  if(gap >= 15)  return {cls:'adiantada', rot:'verba à frente do tempo'};
  return {cls:'noritmo', rot:'no ritmo'};
}
function renderVerba(){
  const host = document.getElementById('v-verba');
  if(!host) return;
  const comVerba = NOAR.filter(c=>Number(c.verba||0) > 0).map(c=>{
    const pctT = Number(c.pct_tempo||0), pctG = Number(c.pct_gasto||0);
    return Object.assign({}, c, {pctT, pctG, gap: pctG - pctT, est: classeVerba(pctG-pctT, pctG)});
  });
  const contagem = {todas:comVerba.length, atrasada:0, noritmo:0, adiantada:0, estourou:0};
  comVerba.forEach(c=>contagem[c.est.cls]++);
  const filtros = [
    {id:'todas',     rot:'Todas'},
    {id:'atrasada',  rot:'Verba atrás'},
    {id:'noritmo',   rot:'No ritmo'},
    {id:'adiantada', rot:'Verba à frente'},
    {id:'estourou',  rot:'Estourada'}
  ].filter(f=>f.id==='todas' || contagem[f.id]);
  const barra = document.getElementById('f-verba');
  if(barra) barra.innerHTML = filtros.map(f=>
    `<button class="chip${filtroVerba===f.id?' on':''}" data-f="${f.id}">${f.rot} <b>${contagem[f.id]}</b></button>`).join('');
  if(barra) barra.querySelectorAll('button').forEach(b=>b.onclick=()=>{ filtroVerba=b.dataset.f; renderVerba(); });

  const lista = comVerba
    .filter(c=>filtroVerba==='todas' || c.est.cls===filtroVerba)
    .sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
  const teto = Math.max(100, ...lista.map(c=>c.pctG));
  host.innerHTML = lista.length ? lista.map(c=>`
    <div class="tv ${c.est.cls}">
      <div class="tv-nome">${c.curso} <span class="tv-tag">${c.est.rot}</span></div>
      <div class="tv-num">${c.pctG.toFixed(0)}% <span class="mu">da verba</span></div>
      <div class="tv-trilho"><i style="width:${100*c.pctG/teto}%"></i><span class="tv-tempo" style="left:${100*c.pctT/teto}%"></span></div>
      <div class="tv-pe">
        <span>${BRL(c.gasto)} de ${BRL(c.verba)} · ${c.pctT.toFixed(0)}% do tempo corrido · faltam ${c.dias_restantes} dias</span>
        <span class="tv-selo">${c.gap>0?'+':''}${c.gap.toFixed(0)} pts</span>
      </div>
    </div>`).join('') : '<div class="empty">Nenhuma campanha neste recorte.</div>';
}

// Projecao a partir do que ESTA campanha esta fazendo, nao do que outras turmas
// fizeram. Duas contas simples, as duas verificaveis na propria tela:
//
//   pela verba  = leads + (verba que falta / CPL observado ate agora)
//   pelo ritmo  = leads + (leads por dia das ultimas 2 semanas x dias restantes)
//
// A de trabalho e a MENOR das duas. A da verba sozinha supoe que a verba inteira
// sera gasta e ao mesmo custo; a do ritmo sozinha ignora que a verba pode acabar
// antes. Uma segura a outra.
//
// A curva historica saiu do destaque: mesmo atualizada (desde 07/09 ela le
// turmas + campanhas encerradas), ela supoe que esta campanha vai se comportar
// como a media das anteriores — ignorando sazonalidade, excesso de oferta do
// curso e tudo que so existe nesta campanha. Fica como referencia, no rodape.
function projeta(c){
  const leads = Number(c.leads||0), rest = Number(c.dias_restantes||0);
  const gasto = Number(c.gasto||0), verba = Number(c.verba||0);
  if(!rest) return null;

  const cpl = leads > 0 && gasto > 0 ? gasto/leads : null;
  const falta = verba > 0 ? Math.max(0, verba - gasto) : null;
  const porVerba = (cpl && falta !== null) ? leads + Math.floor(falta/cpl) : null;

  const serie = RITMO.filter(r=>r.curso===c.curso);
  let ritmo = null, porRitmo = null, janela = 0;
  if(serie.length > 1){
    const acum = serie.map(r=>Number(r.leads_acum));
    const n = acum.length; janela = Math.min(14, n-1);
    ritmo = (acum[n-1] - acum[n-1-janela]) / janela;
    porRitmo = Math.round(leads + ritmo*rest);
  }

  const candidatos = [porVerba, porRitmo].filter(v=>v!==null && isFinite(v));
  if(!candidatos.length) return null;
  const trabalho = Math.min.apply(null, candidatos);
  return { cpl, falta, verba, porVerba, porRitmo, ritmo, janela, trabalho,
           limite: (porVerba !== null && trabalho === porVerba) ? 'verba' : 'ritmo' };
}

function desenhaCurva(curso){
  const c = CAMP.find(x=>x.curso===curso);
  const serie = RITMO.filter(r=>r.curso===curso);
  if(!c || !serie.length) return;

  const dd = n => String(n).padStart(2,'0');
  const labels = serie.map(r=>r.dia.slice(8,10)+'/'+r.dia.slice(5,7));
  const real = serie.map(r=>Number(r.leads_acum));
  const esperado = serie.map(r=>r.esperado_acum===null?null:Number(r.esperado_acum));
  const nR = real.length, ultimo = real[nR-1];
  const total = Number(c.dias_total), corridos = Number(c.dias_decorridos), restantes = Number(c.dias_restantes);
  const pj = projeta(c);

  document.getElementById('hint-curva').textContent =
    'Leads acumulados até hoje e a projeção do que falta, pelo custo por lead e pela verba desta campanha.';

  // dias que faltam, na mesma regua dos dias corridos
  const dias = [];
  for(let k=corridos+1;k<=total;k++) dias.push(k);
  const labelsFut = dias.map(k=>{
    const d = new Date(c.data_inicio+'T00:00:00'); d.setDate(d.getDate()+k-1);
    return dd(d.getDate())+'/'+dd(d.getMonth()+1);
  });
  const vazio = new Array(nR-1).fill(null);
  const emenda = a => vazio.concat([ultimo]).concat(a);
  // reta do ultimo ponto ate o alvo: ninguem sabe a forma do que ainda nao
  // aconteceu, e fingir uma curva ai e enfeite que vira promessa
  const reta = alvo => dias.map((_,i)=> alvo===null ? null : Math.round(ultimo + (alvo-ultimo)*(i+1)/dias.length));

  // Caixa de leitura: do mais certo para o menos certo, e nada de modelo em destaque.
  const box = document.getElementById('box-curva');
  if(box){
    if(!restantes){
      box.innerHTML = `<p class="pj-aviso">Campanha encerrada em ${c.data_fim.slice(8,10)}/${c.data_fim.slice(5,7)} com <b>${N(c.leads)} leads</b>. Não há mais o que projetar.</p>`;
    } else if(!pj){
      box.innerHTML = `<p class="pj-aviso">Sem base para projetar: a campanha ainda não tem verba registrada nem dias suficientes de captação. Por enquanto valem os <b>${N(c.leads)} leads</b> já captados.</p>`;
    } else {
      const rd = pj.ritmo !== null ? pj.ritmo.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}) : null;
      const cardVerba = pj.porVerba !== null
        ? `<div class="pj-item${pj.limite==='verba'?' destaque':''}"><span class="pj-r">Pela verba que falta</span><span class="pj-v">${N(pj.porVerba)}</span><span class="pj-n">${BRL(pj.falta)} a investir ÷ CPL de ${BRL2(pj.cpl)} = ${N(pj.porVerba - c.leads)} leads a mais</span></div>`
        : `<div class="pj-item"><span class="pj-r">Pela verba que falta</span><span class="pj-v pj-faixa">sem base</span><span class="pj-n">campanha sem verba registrada ou sem custo por lead ainda</span></div>`;
      const cardRitmo = pj.porRitmo !== null
        ? `<div class="pj-item${pj.limite==='ritmo'?' destaque':''}"><span class="pj-r">Pelo ritmo atual</span><span class="pj-v">${N(pj.porRitmo)}</span><span class="pj-n">${rd} leads/dia nos últimos ${pj.janela} dias × ${restantes} dias restantes</span></div>`
        : '';
      box.innerHTML = `<div class="pj">
           <div class="pj-item"><span class="pj-r">Captados até hoje</span><span class="pj-v">${N(c.leads)}</span><span class="pj-n">${corridos} de ${total} dias · ${PCT(c.pct_tempo)} do tempo. Se parar agora, é o número final.</span></div>
           ${cardVerba}${cardRitmo}
         </div>
         <p class="pj-aviso"><b>Trabalhe com ${N(pj.trabalho)}</b>, a menor das duas: a conta da verba supõe que ela será gasta inteira e ao mesmo custo; a do ritmo ignora que a verba pode acabar antes. <b>Nenhum dos dois é promessa</b>: o custo por lead sobe quando o público satura, e verba, concorrência e sazonalidade mudam o jogo em dias.</p>
         ${c.proj_leads ? `<p class="pj-ref">Só como referência: no padrão das turmas e campanhas já encerradas deste curso, o fechamento daria <b>${N(c.proj_leads)}</b>. Não é meta nem previsão desta campanha.</p>` : ''}`;
    }
  }

  const datasets = [
    {label:'Leads acumulados (real)', data:real, borderColor:NAVY, backgroundColor:'rgba(229,107,57,.16)', fill:true, tension:.2, borderWidth:3, pointRadius:0},
    {label:'Caminho esperado', data:esperado, borderColor:CINZA, borderDash:[6,4], tension:.2, borderWidth:2, pointRadius:0}
  ];
  if(pj){
    const teto = Math.max(pj.porVerba ?? 0, pj.porRitmo ?? 0);
    datasets.push({label:'Se parar hoje', data:emenda(dias.map(()=>ultimo)), borderColor:'rgba(138,145,158,.5)', borderDash:[2,3], tension:0, borderWidth:1, pointRadius:0});
    datasets.push({label:'_teto', data:emenda(reta(teto)), borderColor:'rgba(14,158,118,.2)', backgroundColor:'rgba(14,158,118,.09)', fill:'-1', tension:0, borderWidth:1, pointRadius:0});
    datasets.push({label:'Projeção de trabalho', data:emenda(reta(pj.trabalho)), borderColor:VERDE, borderDash:[4,3], tension:0, borderWidth:2.5, pointRadius:0});
  }

  mkChart('c-curva','line',{labels: labels.concat(labelsFut), datasets},
    {plugins:{legend:{display:true,labels:{font:{size:10},boxWidth:14,
        filter:it=>!String(it.text).startsWith('_')}}},
     scales:{y:{beginAtZero:true,title:{display:true,text:'leads acumulados'}},
             x:{ticks:{font:{size:9},maxRotation:60,minRotation:0,autoSkip:true,maxTicksLimit:18}}}});
}

// o botao vive na casca (shell.js); aqui so o cabecalho de impressao
window.imprimirPagina = ()=>{
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
  CAMP=a.data||[]; NOAR=CAMP.filter(c=>!c.encerrada); FIM=CAMP.filter(c=>c.encerrada); RITMO=b.data; CURVA=c.data; MIDIA=d.data; ALERTAS=e.data||[];
  MIDIA_ATE = f.data || null;
  if(window.Dash) Dash.stamp();
  document.getElementById('rodape').innerHTML =
    `Leitura ao vivo · leads pela regra anti-refire de 90 dias · mídia da planilha Campanhas_Vanzolini_Consolidado${MIDIA_ATE?' (até '+MIDIA_ATE.split('-').reverse().join('/')+')':''}, carga automática às 6h e às 18h; o dia fecha na planilha só no dia seguinte, então a mídia anda um dia atrás dos leads · CTR calculado, nunca importado · consultado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
  render();
}

if(!window.AGUARDA_PIN) carregar();
