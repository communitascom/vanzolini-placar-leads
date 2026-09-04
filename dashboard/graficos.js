/* Painéis Communitas | helpers de gráfico em SVG puro (Parte 2).
   Uso:
     PaineisCommunitas.linha(document.getElementById('pLinha'), {
       rotulos:['S23',...], series:[{nome:'2026',valores:[...]},{nome:'2025',valores:[...]}],
       max:300, passos:[0,100,200,300], mostrarRotulos:[0,3,6,9,11], sufixo:' leads' });
     PaineisCommunitas.barras(document.getElementById('pBarras'), {
       rotulos:['jan',...], valores:[...], max:1200, passos:[0,400,800,1200], foco:7, sufixo:' leads' });
   O host precisa de position:relative (classe .plot do kit) e ganha o tooltip sozinho.
   Série 1 é sempre laranja com área em gradiente; a série 2 é linha azul limpa. */
(function(){
  var CORES=['#E56B39','#1F6FD0','#0E9E76','#7A57C7','#B08800'];
  var TINT='#FDEEE6', GRID='#EEF0F3';
  var NS='http://www.w3.org/2000/svg';
  var fmt=function(n){ return Number(n).toLocaleString('pt-BR'); };
  function el(tag,attrs,parent){ var e=document.createElementNS(NS,tag); for(var k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
  function tooltip(host){ var t=host.querySelector('.tt'); if(!t){ t=document.createElement('div'); t.className='tt'; host.appendChild(t); } return t; }
  function gradiente(svg,id,cor){
    var defs=el('defs',{},svg); var g=el('linearGradient',{id:id,x1:0,y1:0,x2:0,y2:1},defs);
    el('stop',{offset:0,'stop-color':cor,'stop-opacity':.26},g); el('stop',{offset:1,'stop-color':cor,'stop-opacity':0},g);
  }

  function linha(host,o){
    var W=o.largura||720,H=o.altura||250,L=40,R=52,T=18,B=30;
    var tt=tooltip(host), rot=o.rotulos, s=o.series, n=rot.length;
    var max=o.max||Math.max.apply(null,s.map(function(q){return Math.max.apply(null,q.valores);}))*1.1;
    var x=function(i){return L+i*(W-L-R)/(n-1);}, y=function(v){return H-B-(v/max)*(H-B-T);};
    var svg=el('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':o.titulo||''}); host.insertBefore(svg,tt);
    var gid='g'+Math.random().toString(36).slice(2,8); gradiente(svg,gid,CORES[0]);
    (o.passos||[0,max]).forEach(function(g){ el('line',{x1:L,x2:W-R,y1:y(g),y2:y(g),stroke:GRID,'stroke-width':1},svg); var t=el('text',{x:L-8,y:y(g)+4,'text-anchor':'end'},svg); t.textContent=fmt(g); });
    var a=s[0].valores;
    el('path',{d:'M'+a.map(function(v,i){return x(i)+','+y(v);}).join(' L')+' L'+x(n-1)+','+y(0)+' L'+x(0)+','+y(0)+' Z',fill:'url(#'+gid+')'},svg);
    for(var k=s.length-1;k>=0;k--) el('polyline',{points:s[k].valores.map(function(v,i){return x(i)+','+y(v);}).join(' '),fill:'none',stroke:CORES[k],'stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
    el('circle',{cx:x(n-1),cy:y(a[n-1]),r:4,fill:CORES[0]},svg);
    var lf=el('text',{x:x(n-1)+8,y:y(a[n-1])+4,'class':'lbl-fim'},svg); lf.textContent=fmt(a[n-1]);
    (o.mostrarRotulos||rot.map(function(_,i){return i;})).forEach(function(i){ var t=el('text',{x:x(i),y:H-8,'text-anchor':'middle'},svg); t.textContent=rot[i]; });
    var cross=el('line',{x1:0,x2:0,y1:T,y2:H-B,stroke:'#1A1A1A','stroke-width':1,'stroke-dasharray':'3 3',opacity:0},svg);
    var dots=s.map(function(q,k){return el('circle',{r:4.5,fill:CORES[k],stroke:'#fff','stroke-width':2,opacity:0},svg);});
    var hit=el('rect',{x:L-12,y:0,width:W-L-R+24,height:H,fill:'transparent'},svg);
    hit.addEventListener('mousemove',function(e){
      var r=svg.getBoundingClientRect(), px=(e.clientX-r.left)/r.width*W, best=0, dist=1e9;
      for(var i=0;i<n;i++){ var d=Math.abs(x(i)-px); if(d<dist){dist=d;best=i;} }
      cross.setAttribute('x1',x(best)); cross.setAttribute('x2',x(best)); cross.setAttribute('opacity',1);
      var top=1e9, html='<b>'+(o.prefixoTooltip||'')+rot[best]+'</b>';
      s.forEach(function(q,k){ var v=q.valores[best]; dots[k].setAttribute('cx',x(best)); dots[k].setAttribute('cy',y(v)); dots[k].setAttribute('opacity',1); top=Math.min(top,y(v));
        html+='<div class="l"><i style="background:'+CORES[k]+'"></i>'+q.nome+' &nbsp;<b>'+fmt(v)+'</b>'+(o.sufixo||'')+'</div>'; });
      tt.innerHTML=html; tt.style.left=(x(best)/W*r.width)+'px'; tt.style.top=(top/H*r.height)+'px'; tt.style.opacity=1;
    });
    hit.addEventListener('mouseleave',function(){ cross.setAttribute('opacity',0); dots.forEach(function(d){d.setAttribute('opacity',0);}); tt.style.opacity=0; });
    return svg;
  }

  function barras(host,o){
    var W=o.largura||400,H=o.altura||250,L=36,R=8,T=26,B=30;
    var tt=tooltip(host), rot=o.rotulos, v=o.valores, n=v.length;
    var max=o.max||Math.max.apply(null,v)*1.1, slot=(W-L-R)/n, bw=Math.min(28,slot*.6);
    var foco=(o.foco===undefined)?n-1:o.foco;
    var y=function(val){return H-B-(val/max)*(H-B-T);};
    var svg=el('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':o.titulo||''}); host.insertBefore(svg,tt);
    (o.passos||[0,max]).forEach(function(g){ el('line',{x1:L,x2:W-R,y1:y(g),y2:y(g),stroke:GRID,'stroke-width':1},svg); var t=el('text',{x:L-8,y:y(g)+4,'text-anchor':'end'},svg); t.textContent=fmt(g); });
    v.forEach(function(val,i){
      var x0=L+i*slot+(slot-bw)/2, y0=y(val), y1=y(0), r=4, atual=(i===foco);
      var d='M'+x0+','+y1+' V'+(y0+r)+' Q'+x0+','+y0+' '+(x0+r)+','+y0+' H'+(x0+bw-r)+' Q'+(x0+bw)+','+y0+' '+(x0+bw)+','+(y0+r)+' V'+y1+' Z';
      var bar=el('path',{d:d,fill:atual?CORES[0]:TINT},svg);
      var t=el('text',{x:x0+bw/2,y:H-8,'text-anchor':'middle'},svg); t.textContent=rot[i];
      if(atual){ var lf=el('text',{x:x0+bw/2,y:y0-8,'text-anchor':'middle','class':'lbl-fim'},svg); lf.textContent=fmt(val); }
      var hit=el('rect',{x:L+i*slot,y:T,width:slot,height:H-B-T,fill:'transparent'},svg);
      hit.addEventListener('mouseenter',function(){ var rr=svg.getBoundingClientRect(); bar.setAttribute('fill',atual?'#D25E2E':'#F7C9B0');
        tt.innerHTML='<b>'+rot[i]+'</b><div class="l"><i style="background:'+CORES[0]+'"></i>'+fmt(val)+(o.sufixo||'')+'</div>';
        tt.style.left=((x0+bw/2)/W*rr.width)+'px'; tt.style.top=(y0/H*rr.height)+'px'; tt.style.opacity=1; });
      hit.addEventListener('mouseleave',function(){ bar.setAttribute('fill',atual?CORES[0]:TINT); tt.style.opacity=0; });
    });
    return svg;
  }

  window.PaineisCommunitas={linha:linha,barras:barras,cores:CORES,fmt:fmt};
})();
