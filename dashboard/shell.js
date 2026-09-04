// Casca do Dashboard Vanzolini: barra do cliente, menu lateral, trava de PIN e
// assinatura. Cada página é uma casca sobre o mesmo CSS/JS de dados das páginas
// antigas (placar.js, campanhas.js, historico-dinamico.js), como o README exige:
// o que muda vem do DOM, não de cópia de lógica.
//
// Ordem no HTML: <main>...</main>, scripts de dados (com window.AGUARDA_PIN = true),
// e por último este arquivo. Depois do PIN, ele chama window.iniciarPainel() se
// existir, senão carregar(). A sessão do PIN é a mesma de cliente.html.
(function(){
  var PIN = "2665";
  var CHAVE = "vanzolini_placar_pin_ok";
  var PAGINAS = [
    {id:"inicio",        href:"index.html",         ico:"home",     rot:"Início"},
    {id:"leads",         href:"leads.html",         ico:"group",    rot:"Placar de leads"},
    {id:"campanhas",     href:"campanhas.html",     ico:"campaign", rot:"Campanhas em andamento"},
    {id:"historico",     href:"historico.html",     ico:"history",  rot:"Histórico e investimento"},
    {id:"institucional", href:"institucional.html", ico:"verified", rot:"Campanha institucional"}
  ];
  var FUTURAS = [
    {ico:"share",   rot:"Social orgânico"},
    {ico:"search",  rot:"Busca orgânica"},
    {ico:"mail",    rot:"E-mail"}
  ];
  var ANEL = '<svg><use href="#anel"/></svg>';
  var pagina = document.body.dataset.pagina || "inicio";
  var titulo = document.body.dataset.titulo || "Dashboard";

  // símbolo do anel (assinatura Communitas), uma vez por página
  var simb = document.createElement("div");
  simb.style.display = "none";
  simb.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><symbol id="anel" viewBox="0 0 429.4 428.8"><path fill="currentColor" d="M426,251.6c7.5-39.6,2.3-81.4-12.9-118.7C382,56.8,307.6,4.5,225.5.3,147.1-3.9,71.9,35.7,31.3,102.9c-66.6,111.3-23.3,253.1,95.2,306.1,4.1,1.3,6.1-.8,8.1-4,1.4-2.3,6.5-13.4,9.6-20.3l16.8-41.1c1.4-4.1,3.6-9.2,3.8-11.5,1.1-4.3,1.1-9-4.7-13.2-34.6-18-57.9-50.1-63.7-88.2-.9-5-1.4-10.2-1.4-15.3,0-1.9,0-3.7.1-5.7.1-3.1.3-6.3.7-9.4,6.9-65.4,65.5-112.8,130.9-105.9,65.4,6.9,112.8,65.5,106,130.9-6.3,59.6-55.5,104.2-113.6,106.5-9.4,1.3-11.2,7.3-11.4,8.8-1.3,4.9-.9,12.3-1.2,18.9.5,22.1.8,38.7.7,59.8,0,8.4,5.5,9.3,10.6,9.4,17,.2,29.2-1.6,45.1-5,21.8-4.9,42.7-13.2,61.9-24.7,52.7-30.8,89-83.4,100.9-143.1-.2-.7,0-1.3.2-1.9,0-.8.2-1.6.3-2.4"/></symbol></svg>';
  document.body.insertBefore(simb, document.body.firstChild);

  // barra do cliente
  var barra = document.createElement("div");
  barra.className = "barra-topo";
  barra.innerHTML =
    '<div class="in">' +
      '<div class="marca"><img src="logo-branco.png" alt="Fundação Vanzolini"><span class="sep"></span><h1>' + titulo + '</h1></div>' +
      '<div class="dir"><span class="tag" id="tagTopo"><b>conectando</b></span>' +
      '<span class="assina">' + ANEL + 'Communitas</span></div>' +
    '</div>';
  document.body.insertBefore(barra, simb.nextSibling);

  // layout: menu + conteúdo
  var main = document.querySelector("main");
  var layout = document.createElement("div");
  layout.className = "layout";
  var menu = document.createElement("aside");
  menu.className = "menu";
  menu.setAttribute("aria-label", "Relatórios");
  var h = '<div class="titulo">Relatórios</div>';
  PAGINAS.forEach(function(p){
    h += '<a href="' + p.href + '" class="' + (p.id === pagina ? "on" : "") + '"><span class="ms">' + p.ico + '</span>' + p.rot + '</a>';
  });
  h += '<div class="sep"></div>';
  FUTURAS.forEach(function(p){
    h += '<a class="breve" href="#"><span class="ms">' + p.ico + '</span>' + p.rot + '<small>em breve</small></a>';
  });
  h += '<div class="rodape-menu">Dados ao vivo, leitura apenas.<br><span class="credito">' + ANEL + 'por Communitas</span></div>';
  menu.innerHTML = h;
  main.parentNode.insertBefore(layout, main);
  layout.appendChild(menu);
  layout.appendChild(main);
  main.classList.add("wrap");

  // trava de PIN
  var gate = document.createElement("div");
  gate.id = "pinGate";
  gate.innerHTML =
    '<div class="caixa">' +
      '<img class="logo-pin" src="logo-branco.png" alt="Fundação Vanzolini">' +
      '<h2>Dashboard de marketing</h2>' +
      '<p>Digite o código de acesso para ver os dados.</p>' +
      '<input type="password" id="pinInput" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••">' +
      '<button class="btn" id="pinBtn">Entrar</button>' +
      '<div class="erroPin" id="erroPin"></div>' +
      '<span class="credito">' + ANEL + 'por Communitas</span>' +
    '</div>';
  document.body.appendChild(gate);
  layout.classList.add("oculto");
  barra.classList.add("oculto");

  // utilidades compartilhadas pelas páginas novas
  window.Dash = {
    tag: function(html, estado){
      var t = document.getElementById("tagTopo");
      if (!t) return;
      t.className = "tag" + (estado ? " " + estado : "");
      t.innerHTML = html;
    },
    hora: function(){ return new Date().toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"}); },
    anel: ANEL
  };

  function iniciar(){
    if (typeof window.iniciarPainel === "function") window.iniciarPainel();
    else if (typeof window.carregar === "function") window.carregar();
  }
  function liberar(){
    gate.classList.add("oculto");
    layout.classList.remove("oculto");
    barra.classList.remove("oculto");
    iniciar();
  }
  function verificar(){
    var inp = document.getElementById("pinInput");
    if (inp.value.trim() === PIN){
      sessionStorage.setItem(CHAVE, "1");
      liberar();
    } else {
      document.getElementById("erroPin").textContent = "Código incorreto.";
      inp.value = ""; inp.focus();
    }
  }
  document.getElementById("pinBtn").addEventListener("click", verificar);
  document.getElementById("pinInput").addEventListener("keydown", function(e){ if (e.key === "Enter") verificar(); });

  // ?pin=NNNN na URL: mesmo PIN, útil para renderização automática (Chrome headless) e
  // para link direto; a segurança é a mesma, o PIN já é conferido no navegador.
  var qs = new URLSearchParams(location.search);
  if (qs.get("pin") === PIN) sessionStorage.setItem(CHAVE, "1");
  if (sessionStorage.getItem(CHAVE) === "1") liberar();
  else document.getElementById("pinInput").focus();

})();
