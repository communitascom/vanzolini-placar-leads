// Logica do Historico Dinamico, compartilhada por historico-dinamico.html e
// dashboard/historico.html. Era inline no HTML ate 04/09/2026; virou arquivo
// pela mesma regra de placar.js e campanhas.js: uma copia congelada foi o que
// fez o historico estatico divergir do banco por dois meses.
//   - se a pagina define window.AGUARDA_PIN, carregarDados() nao dispara sozinho.
const SUPABASE_URL = "https://ltasijrhkotyyrxnavab.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YXNpanJoa290eXlyeG5hdmFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjk5NDAsImV4cCI6MjA5NjcwNTk0MH0.XAJmbTSm6d5Y6xobOLceHlVr0e_iratHW_u6atzUC5c";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BRL=v=>'R$ '+(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
const N=v=>(v||0).toLocaleString('pt-BR');
const NAVY='#E56B39',AZUL='#1F6FD0',AZUL2='#7A57C7',CINZA='#C5CAD3',CIANO='#0E9E76'; // paleta Painéis Communitas
const MESES_PT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
let DATA = {months:[], hist:[], camp:[]};
let labelsAll = [];

function theme(c){
 const s=(c||'').toLowerCase();
 if(s.includes('mba')) return 'MBA';
 if(/iso|iqnet|\bona\b|lgpd|27001|9001|45001|14001|7101|42001|22301|37001|16949|27701|auditor|acredita|requisitos|compliance|dpo/.test(s)) return 'ISO/Qualidade';
 if(/lean|seis sigma|belt|\btpm\b|fmea|jasp|processo|melhoria|operaç|supply|log[ií]stica|ind[uú]stria 4|manufactur/.test(s)) return 'Lean/Operações';
 if(/agile|scrum|okr|kanban|[áa]gil/.test(s)) return 'Agile';
 if(/intelig[êe]ncia artificial|\bia\b|\bai\b|dominando a ia|aplicaç[õo]es de ia/.test(s)) return 'IA';
 if(/lideran|pessoas|emocional|autoconhecimento|storytelling|orat[óo]ria|customer|feminina|mentoria|assertiva/.test(s)) return 'Liderança/Soft';
 return 'Projetos/Outros';
}
function midx(m){return DATA.months.indexOf(m);}

const state={tema:'',curso:'',ini:0,fim:0};
let charts={};

function fillCursos(){
 const list=DATA.hist.filter(h=>(!state.tema||theme(h.curso)===state.tema)).sort((a,b)=>a.curso.localeCompare(b.curso,'pt'));
 document.getElementById('f-curso').innerHTML='<option value="">Todos os cursos</option>'+list.map(h=>'<option value="'+h.curso.replace(/"/g,'&quot;')+'">'+(h.curso.length>55?h.curso.slice(0,55)+'…':h.curso)+'</option>').join('');
}
const selI=document.getElementById('f-ini'),selF=document.getElementById('f-fim');

function coursesSel(){
 return DATA.hist.filter(h=> (state.curso? h.curso===state.curso : (!state.tema||theme(h.curso)===state.tema)) );
}
function inPeriod(i){return i>=state.ini && i<=state.fim;}
function campSel(){
 return DATA.camp.filter(c=>{
  if(state.curso && c.curso!==state.curso) return false;
  if(!state.curso && state.tema && theme(c.curso)!==state.tema) return false;
  const idx=midx(c.mes);
  const fullRange=(state.ini===0 && state.fim===DATA.months.length-1);
  if(idx<0) return fullRange;
  return inPeriod(idx);
 });
}

function render(){
 const cs=coursesSel();
 const camps=campSel();
 const series=[],lbls=[];
 for(let i=state.ini;i<=state.fim;i++){lbls.push(labelsAll[i]);series.push(cs.reduce((a,h)=>a+(h.vals[i]||0),0));}
 const totLeads=series.reduce((a,b)=>a+b,0);
 let l25=0,l26=0;
 for(let i=state.ini;i<=state.fim;i++){const y=DATA.months[i].slice(0,4);const v=cs.reduce((a,h)=>a+(h.vals[i]||0),0);if(y==='2025')l25+=v;else l26+=v;}
 const inv=camps.reduce((a,c)=>a+(c.inv||0),0);
 const cplv=camps.filter(c=>c.cpl&&c.leads>0).map(c=>c.cpl).sort((a,b)=>a-b);
 const cplMed=cplv.length?cplv[Math.floor(cplv.length/2)]:0;
 const turmas=camps.length, zero=camps.filter(c=>(c.leads||0)===0).length;

 const daily=[];
 for(let i=state.ini;i<=state.fim;i++){const v=cs.reduce((a,h)=>a+(h.vals[i]||0),0);const yy=+DATA.months[i].slice(0,4),mm=+DATA.months[i].slice(5,7);daily.push(v/new Date(yy,mm,0).getDate());}
 const dsort=[...daily].sort((a,b)=>a-b);
 const medDay=dsort.length?(dsort.length%2?dsort[(dsort.length-1)/2]:(dsort[dsort.length/2-1]+dsort[dsort.length/2])/2):0;
 const vcamps=camps.filter(c=>c.pagantes!=null);
 const totInsc=vcamps.reduce((a,c)=>a+(c.inscritos||0),0);
 const totPag=vcamps.reduce((a,c)=>a+(c.pagantes||0),0);
 const totCustoV=vcamps.reduce((a,c)=>a+(c.custoTotal||0),0);
 const convGlobal=totInsc?totPag/totInsc*100:null;
 const cacGlobal=totPag?totCustoV/totPag:null;
 const kpis=[
  {v:N(totLeads),l:'Leads no período',s:(l25+l26>0)?('2025: '+N(l25)+' · 2026: '+N(l26)):'',c:''},
  {v:N(Math.round(medDay)),l:'Mediana diária',s:'leads/dia em mês típico',c:''},
  {v:N(turmas),l:'Turmas no período',s:zero+' sem captação',c:zero>0?'down':''},
  {v:BRL(inv),l:'Investimento (mkt)',s:'no período',c:''},
  {v:cplMed?'R$ '+cplMed.toFixed(0):'—',l:'CPL mediano/turma',s:'custo por lead',c:''},
  {v:turmas?N(Math.round(totLeads/Math.max(1,turmas))):'—',l:'Leads médios/turma',s:'',c:''},
  {v:convGlobal!=null?convGlobal.toFixed(0)+'%':'—',l:'Conversão insc.→pagante',s:totPag?N(totPag)+' matrículas':'sem dado comercial',c:''},
  {v:cacGlobal!=null?'R$ '+cacGlobal.toFixed(0):'—',l:'CAC médio',s:'custo total ÷ matrícula',c:''},
 ];
 document.getElementById('kpis').innerHTML=kpis.map(k=>'<div class="kpi"><div class="v">'+k.v+'</div><div class="l">'+k.l+'</div><div class="s '+k.c+'">'+k.s+'</div></div>').join('');

 const af=[];if(state.tema)af.push(state.tema);if(state.curso)af.push('curso selecionado');
 document.getElementById('activeflt').textContent=af.length?('Filtro: '+af.join(' · ')):'Visão geral';
 document.getElementById('tit-mensal').textContent = state.curso? ('Evolução mensal · '+(state.curso.length>50?state.curso.slice(0,50)+'…':state.curso)) : (state.tema? ('Evolução mensal · '+state.tema):'Evolução mensal de leads');

 mkChart('c-mensal','line',{labels:lbls,datasets:[{label:'Leads',data:series,borderColor:NAVY,backgroundColor:'rgba(229,107,57,.16)',tension:.3,fill:true,borderWidth:3,pointRadius:lbls.length>14?2:3,pointBackgroundColor:AZUL}]},
  {plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,title:{display:true,text:'leads/mês'}}}});

 const base=DATA.hist.filter(h=>(!state.tema||theme(h.curso)===state.tema));
 const ranked=base.map(h=>{let s=0;for(let i=state.ini;i<=state.fim;i++)s+=h.vals[i]||0;return {curso:h.curso,leads:s};})
   .filter(x=>x.leads>0).sort((a,b)=>b.leads-a.leads).slice(0,12);
 mkChart('c-topcursos','bar',{labels:ranked.map(t=>t.curso.length>32?t.curso.slice(0,32)+'…':t.curso),
   datasets:[{label:'Leads',data:ranked.map(t=>t.leads),backgroundColor:ranked.map(t=>state.curso&&t.curso===state.curso?AZUL:NAVY)}]},
  {indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>ranked[items[0].dataIndex].curso}}},scales:{x:{beginAtZero:true},y:{ticks:{font:{size:10}}}}});

 renderPareto();
 renderAltaQueda();
 renderPerene();

 const pts=camps.filter(c=>c.inv>0&&c.leads>0&&c.cpl).map(c=>({x:c.inv,y:c.leads,r:Math.max(4,Math.min(26,Math.sqrt(c.cpl)*2)),curso:c.curso,cpl:c.cpl}));
 mkChart('c-disp','bubble',{datasets:[{label:'Turmas',data:pts,backgroundColor:'rgba(229,107,57,.45)',borderColor:NAVY}]},
  {plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items[0].raw.curso,label:p=>{const d=p.raw;return 'Invest: '+BRL(d.x)+' · Leads: '+N(d.y)+' · CPL: R$ '+d.cpl.toFixed(2);}}}},
   scales:{x:{type:'logarithmic',title:{display:true,text:'investimento (R$, escala log)'}},y:{beginAtZero:true,title:{display:true,text:'leads na janela'}}}});

 const valid=camps.filter(c=>c.cpl&&c.leads>0);
 const best=[...valid].sort((a,b)=>a.cpl-b.cpl).slice(0,12);
 const worst=[...valid].sort((a,b)=>b.cpl-a.cpl).slice(0,12);
 const tbl=(rws,cls)=> rws.length? '<table><thead><tr><th>Curso</th><th>Mês</th><th>Leads</th><th>CPL</th></tr></thead><tbody>'+
   rws.map(c=>'<tr><td>'+(c.curso.length>30?c.curso.slice(0,30)+'…':c.curso)+'</td><td>'+(c.mes||'')+'</td><td>'+N(c.leads)+'</td><td class="'+cls+'">R$ '+c.cpl.toFixed(2)+'</td></tr>').join('')+'</tbody></table>' : '<div class="empty">Sem turmas no filtro.</div>';
 document.getElementById('t-best').innerHTML=tbl(best,'good');
 document.getElementById('t-worst').innerHTML=tbl(worst,'bad');

 renderVendas();
 renderCamp();
}

function renderVendas(){
 const camps=campSel().filter(c=>c.pagantes!=null);
 const map={};
 camps.forEach(c=>{
   const o=(map[c.curso]=map[c.curso]||{curso:c.curso,turmas:0,inscritos:0,pagantes:0,custo:0,receita:0});
   o.turmas++; o.inscritos+=c.inscritos||0; o.pagantes+=c.pagantes||0;
   o.custo+=c.custoTotal||0; o.receita+=c.receita||0;
 });
 const arr=Object.values(map).map(o=>Object.assign(o,{
   conv:o.inscritos?o.pagantes/o.inscritos*100:null,
   cac:o.pagantes?o.custo/o.pagantes:null,
   roi:o.custo?o.receita/o.custo:null
 })).sort((a,b)=>b.pagantes-a.pagantes);
 const box=document.getElementById('t-vendas');
 if(!arr.length){box.innerHTML='<div class="empty">Sem matrícula carregada para este filtro ainda. A carga de comercial cobre 92 turmas de 2025-2026, ver Metodologia Leitura Estratégica de Mídia.</div>';return;}
 box.innerHTML='<table><thead><tr><th>Curso</th><th>Turmas c/ dado</th><th>Inscritos</th><th>Pagantes</th><th>Conversão</th><th>CAC</th><th>Receita</th><th>ROI</th></tr></thead><tbody>'+
   arr.map(o=>'<tr><td>'+(o.curso.length>38?o.curso.slice(0,38)+'…':o.curso)+'</td><td>'+o.turmas+'</td><td>'+N(o.inscritos)+'</td><td>'+N(o.pagantes)+'</td><td>'+(o.conv!=null?o.conv.toFixed(0)+'%':'—')+'</td><td>'+(o.cac!=null?'R$ '+o.cac.toFixed(2):'—')+'</td><td>'+BRL(o.receita)+'</td><td>'+(o.roi!=null?o.roi.toFixed(1)+'x':'—')+'</td></tr>').join('')+'</tbody></table>';
}

function renderPerene(){
 const camps=campSel();
 const map={};
 camps.forEach(c=>{const k=c.curso;(map[k]=map[k]||{curso:k,turmas:0,inv:0,leads:0,cpls:[]});map[k].turmas++;map[k].inv+=c.inv||0;map[k].leads+=c.leads||0;if(c.cpl&&c.leads>0)map[k].cpls.push(c.cpl);});
 const hsel={};DATA.hist.forEach(h=>hsel[h.curso]=h.vals);
 const span=state.fim-state.ini+1;
 let arr=Object.values(map).map(o=>{
   const v=hsel[o.curso]||[];let ma=0;for(let i=state.ini;i<=state.fim;i++)if(v[i]&&v[i]>0)ma++;
   const cm=o.cpls.slice().sort((a,b)=>a-b);const cpl=cm.length?cm[Math.floor(cm.length/2)]:0;
   const idx=Math.round((Math.min(o.turmas,8)/8*0.5 + (span?ma/span:0)*0.5)*100);
   return Object.assign(o,{ma:ma,cpl:cpl,idx:idx});
 }).filter(o=>o.turmas>=2 && o.inv>0);
 arr.sort((a,b)=> b.idx-a.idx || b.turmas-a.turmas || b.inv-a.inv);
 const pts=arr.map(o=>({x:o.turmas,y:o.inv,r:Math.max(5,Math.min(28,Math.sqrt(o.leads)/3)),curso:o.curso,leads:o.leads}));
 mkChart('c-perene','bubble',{datasets:[{label:'Cursos',data:pts,backgroundColor:'rgba(14,158,118,.38)',borderColor:'#0E9E76'}]},
  {plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items[0].raw.curso,label:p=>{const d=p.raw;return 'Turmas: '+d.x+' · Invest: '+BRL(d.y)+' · Leads: '+N(d.leads);}}}},
   scales:{x:{beginAtZero:true,title:{display:true,text:'nº de turmas no período'}},y:{type:'logarithmic',title:{display:true,text:'investimento (R$, escala log)'}}}});
 const top=arr.slice(0,15);
 document.getElementById('t-perene').innerHTML= top.length? '<table><thead><tr><th>Curso</th><th>Índice</th><th>Turmas</th><th>Meses</th><th>Investim.</th><th>Leads</th><th>CPL</th></tr></thead><tbody>'+
   top.map(o=>'<tr><td>'+(o.curso.length>34?o.curso.slice(0,34)+'…':o.curso)+'</td><td class="good">'+o.idx+'</td><td>'+o.turmas+'</td><td>'+o.ma+'</td><td>'+BRL(o.inv)+'</td><td>'+N(o.leads)+'</td><td>'+(o.cpl?'R$ '+o.cpl.toFixed(2):'—')+'</td></tr>').join('')+'</tbody></table>'
   : '<div class="empty">Sem cursos perenes neste filtro.</div>';
}
function renderPareto(){
 const cs=coursesSel();
 const arr=cs.map(h=>{let s=0;for(let i=state.ini;i<=state.fim;i++)s+=h.vals[i]||0;return{curso:h.curso,leads:s};}).filter(x=>x.leads>0).sort((a,b)=>b.leads-a.leads);
 const total=arr.reduce((a,b)=>a+b.leads,0)||1;
 const top=arr.slice(0,15);
 let cum=0;const cumpct=top.map(x=>{cum+=x.leads;return +(cum/total*100).toFixed(1);});
 const pct=top.map(t=>+(t.leads/total*100).toFixed(1));
 mkChart('c-pareto','bar',{labels:top.map(t=>t.curso.length>24?t.curso.slice(0,24)+'…':t.curso),
   datasets:[
    {type:'bar',label:'% dos leads',data:pct,backgroundColor:NAVY,order:2},
    {type:'line',label:'% acumulado',data:cumpct,borderColor:AZUL,backgroundColor:AZUL,tension:.2,borderWidth:2,pointRadius:3,order:1}
   ]},
  {plugins:{legend:{display:true,labels:{font:{size:10},boxWidth:12}},
    tooltip:{callbacks:{
      title:items=>top[items[0].dataIndex].curso,
      label:ctx=>ctx.datasetIndex===0
        ? 'Leads: '+N(top[ctx.dataIndex].leads)+' ('+ctx.raw+'% do total)'
        : '% acumulado: '+ctx.raw+'%'
    }}
  },scales:{
    x:{ticks:{font:{size:9},maxRotation:60,minRotation:45}},
    y:{beginAtZero:true,max:100,title:{display:true,text:'% dos leads'},ticks:{callback:v=>v+'%'}}
  }});
 let c2=0,n80=0;for(const x of arr){c2+=x.leads;n80++;if(c2/total>=0.8)break;}
 const top5=arr.slice(0,5).reduce((a,b)=>a+b.leads,0)/total*100;
 document.getElementById('pareto-nota').innerHTML='<b>'+n80+'</b> de '+arr.length+' cursos concentram <b>80%</b> dos leads. Top 5 cursos = <b>'+top5.toFixed(0)+'%</b> do total.';
}
function renderAltaQueda(){
 const base=DATA.hist.filter(h=> (state.curso? h.curso===state.curso : (!state.tema||theme(h.curso)===state.tema)) );
 const arr=base.map(h=>{const a=h.vals.slice(0,6).reduce((x,y)=>x+(y||0),0);const b=h.vals.slice(12,18).reduce((x,y)=>x+(y||0),0);return{curso:h.curso,d:b-a};}).filter(x=>Math.abs(x.d)>0);
 const up=[...arr].filter(x=>x.d>0).sort((a,b)=>b.d-a.d).slice(0,8);
 const down=[...arr].filter(x=>x.d<0).sort((a,b)=>a.d-b.d).slice(0,8);
 const comb=[...up,...down.reverse()];
 mkChart('c-altaqueda','bar',{labels:comb.map(t=>t.curso.length>30?t.curso.slice(0,30)+'…':t.curso),
   datasets:[{label:'Δ leads',data:comb.map(t=>t.d),backgroundColor:comb.map(t=>t.d>=0?'#157A4E':'#C43E3E')}]},
  {indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>comb[items[0].dataIndex].curso,label:p=>(p.raw>=0?'+':'')+N(p.raw)+' leads (jan a jun 26 vs 25)'}}},scales:{x:{title:{display:true,text:'variação de leads'}},y:{ticks:{font:{size:9}}}}});
}
function mkChart(id,type,data,opts){
 if(charts[id])charts[id].destroy();
 charts[id]=new Chart(document.getElementById(id),{type:type,data:data,options:Object.assign({responsive:true,maintainAspectRatio:false},opts)});
}

function mediana(vals){
 const v=vals.slice().sort((a,b)=>a-b);
 if(!v.length) return null;
 return v.length%2 ? v[(v.length-1)/2] : (v[v.length/2-1]+v[v.length/2])/2;
}
function medianaOutrasTurmas(turma){
 const vals=DATA.camp.filter(c=>c.curso===turma.curso && c!==turma && c.cpl && c.leads>0).map(c=>c.cpl);
 return mediana(vals);
}

let sortKey='leads',sortDir=-1;
function renderCamp(){
 const q=document.getElementById('busca').value.toLowerCase();
 let rows=campSel().filter(c=>c.curso.toLowerCase().includes(q));
 rows.sort((a,b)=>{let x=a[sortKey],y=b[sortKey];if(typeof x==='string'){x=x||'';y=y||'';return sortDir*x.localeCompare(y);}return sortDir*((x||0)-(y||0));});
 const cols=[['curso','Curso'],['mes','Mês'],['dias','Dias'],['leads','Leads'],['leads_dia','Leads/dia'],['inv','Investim.'],['cpl','CPL turma'],['pagantes','Pagantes'],['cac','CAC'],['med_outras','Mediana curso'],['delta_cpl','vs mediana']];
 if(!rows.length){document.getElementById('t-camp').innerHTML='<div class="empty">Sem turmas para este filtro.</div>';return;}
 rows=rows.map(c=>{
   const medOutras=medianaOutrasTurmas(c);
   const delta=(c.cpl&&medOutras)?((c.cpl-medOutras)/medOutras*100):null;
   return Object.assign({},c,{med_outras:medOutras,delta_cpl:delta});
 });
 if(sortKey==='med_outras'||sortKey==='delta_cpl'){
   rows.sort((a,b)=>sortDir*((a[sortKey]??-Infinity)-(b[sortKey]??-Infinity)));
 }
 let h='<table><thead><tr>'+cols.map(c=>'<th data-k="'+c[0]+'">'+c[1]+'</th>').join('')+'</tr></thead><tbody>';
 h+=rows.map(c=>{
   const medTxt=c.med_outras!=null?'R$ '+c.med_outras.toFixed(2):'<span class="z">— sem outras turmas</span>';
   const deltaTxt=c.delta_cpl!=null
     ? '<span class="'+(c.delta_cpl<=0?'good':'bad')+'">'+(c.delta_cpl>=0?'+':'')+c.delta_cpl.toFixed(0)+'%</span>'
     : '<span class="z">—</span>';
   const pagTxt=c.pagantes!=null?N(c.pagantes):'<span class="z">—</span>';
   const cacTxt=c.cac!=null?'R$ '+c.cac.toFixed(2):'<span class="z">—</span>';
   return '<tr><td>'+(c.curso.length>40?c.curso.slice(0,40)+'…':c.curso)+'</td><td>'+(c.mes||'')+'</td><td>'+(c.dias||'')+'</td><td>'+N(c.leads)+'</td><td>'+(c.leads_dia?c.leads_dia.toFixed(1):'')+'</td><td>'+BRL(c.inv)+'</td><td>'+(c.cpl?'R$ '+c.cpl.toFixed(2):'—')+'</td><td>'+pagTxt+'</td><td>'+cacTxt+'</td><td>'+medTxt+'</td><td>'+deltaTxt+'</td></tr>';
 }).join('');
 h+='</tbody></table>';
 const el=document.getElementById('t-camp');el.innerHTML=h;
 el.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=-1;}renderCamp();});
}

document.getElementById('f-tema').onchange=e=>{state.tema=e.target.value;state.curso='';fillCursos();render();};
document.getElementById('f-curso').onchange=e=>{state.curso=e.target.value;render();};
selI.onchange=e=>{state.ini=+e.target.value;if(state.ini>state.fim){state.fim=state.ini;selF.value=state.fim;}render();};
selF.onchange=e=>{state.fim=+e.target.value;if(state.fim<state.ini){state.ini=state.fim;selI.value=state.ini;}render();};
document.getElementById('busca').oninput=renderCamp;
document.getElementById('limpar').onclick=()=>{state.tema='';state.curso='';state.ini=0;state.fim=DATA.months.length-1;document.getElementById('f-tema').value='';selI.value=0;selF.value=DATA.months.length-1;document.getElementById('busca').value='';fillCursos();render();};

document.getElementById('imprimir').onclick=()=>{
 const periodo = (state.ini===0 && state.fim===DATA.months.length-1)
   ? 'Histórico completo ('+labelsAll[0]+' a '+labelsAll[labelsAll.length-1]+')'
   : (labelsAll[state.ini]===labelsAll[state.fim] ? labelsAll[state.ini] : labelsAll[state.ini]+' a '+labelsAll[state.fim]);
 const escopo = state.curso ? state.curso : (state.tema ? 'Tema: '+state.tema : 'Todos os cursos');
 document.getElementById('ph-titulo').textContent = 'Fechamento de Leads · '+periodo;
 document.getElementById('ph-sub').textContent = escopo+' · gerado em '+new Date().toLocaleString('pt-BR')+' · Fundação Vanzolini';
 window.print();
};

async function carregarDados(){
 document.getElementById('kpis').innerHTML='<div class="kpi"><div class="v">…</div><div class="l">carregando leitura ao vivo…</div></div>';
 const [m1,m2]=await Promise.all([sb.rpc('historico_mensal'),sb.rpc('historico_turmas')]);
 if(m1.error||m2.error){
   document.getElementById('kpis').innerHTML='<div class="kpi"><div class="v" style="color:#d64545;font-size:16px">Erro ao carregar</div><div class="l">'+((m1.error&&m1.error.message)||(m2.error&&m2.error.message))+'</div></div>';
   return;
 }
 const mensal=m1.data, turmas=m2.data;
 let minMes=mensal.length?mensal[0].mes.slice(0,7):'2025-01';
 mensal.forEach(r=>{const mm=r.mes.slice(0,7);if(mm<minMes)minMes=mm;});
 const hoje=new Date();
 const maxMes=hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');
 const months=[];
 let [ay,am]=minMes.split('-').map(Number);
 const [by,bm]=maxMes.split('-').map(Number);
 while(ay<by||(ay===by&&am<=bm)){months.push(ay+'-'+String(am).padStart(2,'0'));am++;if(am>12){am=1;ay++;}}
 const porCurso={};
 mensal.forEach(r=>{
   const idx=months.indexOf(r.mes.slice(0,7));
   if(idx<0)return;
   if(!porCurso[r.curso])porCurso[r.curso]=new Array(months.length).fill(0);
   porCurso[r.curso][idx]=Number(r.leads);
 });
 const hist=Object.keys(porCurso).map(curso=>({curso,vals:porCurso[curso]}));
 const num=v=>(v!==null&&v!==undefined)?Number(v):null;
 const camp=turmas.map(t=>({
   curso:t.curso, mes:t.mes, ini:t.data_inicio, fim:t.data_fim, dias:t.dias,
   leads:Number(t.leads), inv:Number(t.investimento)||0,
   cpl:num(t.cpl), leads_dia:num(t.leads_dia),
   inscritos:num(t.inscritos), pagantes:num(t.pagantes), taxaPagante:num(t.taxa_pagante),
   custoTotal:num(t.custo_total), cac:num(t.cac), receita:num(t.receita), roi:num(t.roi)
 }));
 DATA={months,hist,camp};
 iniciarComDados();
}

function iniciarComDados(){
 labelsAll=DATA.months.map(m=>{const p=m.split('-');return MESES_PT[+p[1]-1]+'/'+p[0].slice(2);});
 state.fim=DATA.months.length-1;
 const temas=[...new Set(DATA.hist.map(h=>theme(h.curso)))].sort();
 document.getElementById('f-tema').innerHTML='<option value="">Todos os temas</option>'+temas.map(t=>'<option value="'+t+'">'+t+'</option>').join('');
 fillCursos();
 selI.innerHTML=labelsAll.map((l,i)=>'<option value="'+i+'">'+l+'</option>').join('');
 selF.innerHTML=labelsAll.map((l,i)=>'<option value="'+i+'">'+l+'</option>').join('');
 selI.value=0;selF.value=DATA.months.length-1;
 render();
}

if(!window.AGUARDA_PIN) carregarDados();
