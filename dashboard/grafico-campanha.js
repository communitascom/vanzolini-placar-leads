/* Painel de performance de campanha | o grafico do slide, em SVG puro.
   Porte direto do gerador que produziu as pecas aprovadas em agosto e setembro
   de 2026, para tela e PDF saírem identicos ao que o cliente ja viu.

   Uso:
     GraficoCampanha.desenha(document.getElementById('g'), dadosDaRPC);

   O SVG nasce 960x540 com viewBox, entao escala sozinho para a largura do
   card e imprime no mesmo desenho, sem layout separado de impressao.

   A paleta aqui e a do slide (roxo e verde da Vanzolini), nao a laranja dos
   Paineis Communitas, porque o pedido foi reproduzir a peca aprovada. A casca
   da pagina em volta continua no padrao Communitas. */
(function () {
  var PRIM = '#32327F', VIOL = '#4848B5', TEAL = '#0E9E8A';
  var INK = '#2B2B32', BODY = '#565758', MUTED = '#808285', BORDER = '#E2E8F0', SURF = '#F3F3FB';
  var NS = 'http://www.w3.org/2000/svg';

  var br  = function (v) { return Math.round(Number(v || 0)).toLocaleString('pt-BR'); };
  var brl = function (v, c) {
    var n = Number(v || 0);
    return 'R$ ' + (c === false
      ? Math.round(n).toLocaleString('pt-BR')
      : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };
  var pc  = function (v) { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; };
  var dm  = function (iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1]; };
  var dmy = function (iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  var dia = function (iso) { var p = String(iso).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
  var DIA = 86400000;

  // Escapa tambem aspas: o resultado entra em atributo delimitado por aspas
  // (aria-label), onde so & < > deixaria um nome de curso com aspa fechar o
  // atributo e abrir outro.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Escala com passos legiveis. O teto e o valor pedido, nao um multiplo
  // arredondado para cima: arredondar o teto empurrava a linha de meta para o
  // meio do painel e deixava sobra vazia em cima, diferente da peca aprovada.
  // Os passos sao 1, 2 ou 5 vezes potencia de 10, e ficam abaixo do teto.
  function escala(maxValor, alvoPassos) {
    if (!(maxValor > 0)) return { max: 1, passos: [0] };
    var bruto = maxValor / (alvoPassos || 3);
    var mag = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10));
    var norm = bruto / mag, passo;
    if (norm < 1.5) passo = 1 * mag;
    else if (norm < 3) passo = 2 * mag;
    else if (norm < 7) passo = 5 * mag;
    else passo = 10 * mag;
    // Passo nao finito ou zero (valor subnormal, Infinity) travaria o laco.
    if (!isFinite(passo) || passo <= 0) return { max: maxValor, passos: [0] };
    var passos = [];
    for (var v = 0; v <= maxValor + 1e-9 && passos.length < 1000; v += passo) {
      passos.push(Math.round(v * 1e6) / 1e6);
    }
    return { max: maxValor, passos: passos };
  }

  function desenha(host, d) {
    if (!host) return;
    if (!d || d.erro) {
      host.innerHTML = '<p class="vazio">' + esc(d && d.erro ? d.erro : 'sem dado para esta campanha') + '</p>';
      return;
    }

    if (!d.campanha || !d.plano || !d.janela || !d.realizado || !Array.isArray(d.serie)) {
      host.innerHTML = '<p class="vazio">a resposta da API veio em formato inesperado</p>';
      return;
    }
    var camp = d.campanha, plano = d.plano, jan = d.janela, real = d.realizado;
    var proj = d.projecao, serie = d.serie;
    if (!serie.length) {
      host.innerHTML = '<p class="vazio">a campanha ainda nao tem dia com dado carregado</p>';
      return;
    }

    // Eixo do tempo: a campanha inteira, mesmo que o recorte peca menos.
    var INI = dia(jan.campanha_ini), FIM = dia(jan.campanha_fim), CORTE = dia(jan.corte);
    var TOT = Math.max(Math.round((FIM - INI) / DIA), 1);
    var PX0 = 128, PX1 = 762, LBLX = 772;
    var P1 = [186, 296], P2 = [322, 368], P3 = [394, 440];
    var X = function (i) { return PX0 + (PX1 - PX0) * i / TOT; };
    var xd = function (ms) { return X(Math.round((ms - INI) / DIA)); };
    var ys = function (v, vmax, p) { return p[1] - (p[1] - p[0]) * Math.min(v, vmax) / vmax; };

    // Recorte não autoriza falar da campanha: com p_ini/p_fim os totais são do
    // período, e dizer "a campanha entregou X" seria mentira com cara de número.
    var inteira = jan.campanha_inteira !== false;
    var fechada = inteira && camp.encerrada_hoje === true;
    var noDia = !!(d.referencia && d.referencia.hoje === jan.corte);
    var meta = plano.meta_ajustada == null ? null : Number(plano.meta_ajustada);
    var temProj = !!proj;
    var pv = temProj && proj.pela_verba != null ? Number(proj.pela_verba) : null;
    var pr = temProj && proj.pelo_ritmo != null ? Number(proj.pelo_ritmo) : null;

    // O acumulado vem pronto da RPC (serie[].leads_acumulados). Refazer a soma
    // aqui seria justamente a matematica no JavaScript que a RPC existe para
    // evitar; o fallback so cobre resposta antiga.
    var acum = [], soma = 0, maxDia = 0, maxCusto = 0, faltaContrato = false;
    serie.forEach(function (r) {
      var l = Number(r.leads || 0), c = Number(r.custo || 0);
      if (r.leads_acumulados == null) faltaContrato = true;
      soma = r.leads_acumulados != null ? Number(r.leads_acumulados) : soma + l;
      acum.push({ ms: dia(r.dia), v: soma, leads: l, custo: c });
      if (l > maxDia) maxDia = l;
      if (c > maxCusto) maxCusto = c;
    });
    var totalLeads = Number(real.leads != null ? real.leads : soma);
    // O fallback continua existindo para a tela nao morrer, mas para de ser
    // silencioso: serie sem leads_acumulados significa contrato mudado.
    if (faltaContrato && window.console && window.console.warn) {
      window.console.warn('grafico-campanha: serie sem leads_acumulados, acumulado refeito no navegador. A RPC mudou de contrato.');
    }

    var teto1 = Math.max(meta || 0, totalLeads, pv || 0, pr || 0);
    var e1 = escala(teto1 * 1.08, 3);
    // So a mediana historica do CURSO vira linha. Curso sem turma fechada nao
    // ganha regua inventada a partir dele mesmo: ganha uma tag dizendo que nao
    // ha com o que comparar.
    var med = d.mediana || {};
    var medValor = (med.curso == null || !isFinite(Number(med.curso))) ? null : Number(med.curso);
    var e2 = escala(Math.max(maxDia, medValor || 0) * 1.15, 3);
    var e3 = escala(maxCusto * 1.14, 3);

    var s = [];
    var add = function (t) { s.push(t); };
    var txt = function (x, y, t, o) {
      o = o || {};
      return '<text x="' + x + '" y="' + y + '" font-size="' + (o.fs || 8) + '" fill="' + (o.cor || MUTED) + '"' +
        (o.peso ? ' font-weight="' + o.peso + '"' : '') +
        (o.anc ? ' text-anchor="' + o.anc + '"' : '') + '>' + esc(t) + '</text>';
    };
    var linha = function (x1, y1, x2, y2, cor, w, dash, op) {
      return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
        '" y2="' + y2.toFixed(1) + '" stroke="' + cor + '" stroke-width="' + (w || 1) + '"' +
        (dash ? ' stroke-dasharray="' + dash + '"' : '') + (op ? ' opacity="' + op + '"' : '') + '/>';
    };

    // ---------- painel 1: leads acumulados ----------
    add(txt(PX0 - 53, P1[0] - 9, 'Leads acumulados', { fs: 9.5, cor: INK, peso: 700 }));
    add(txt(PX0 + 50, P1[0] - 9,
      !inteira ? 'recorte de ' + dm(jan.ini) + ' a ' + dm(jan.corte) + ', não é a campanha inteira'
      : fechada ? 'curva fechada, a campanha encerrou em ' + dm(jan.campanha_fim)
      : 'linha cheia o realizado até ' + dm(jan.corte) + ', tracejado a projeção até ' + dm(jan.campanha_fim)));
    e1.passos.forEach(function (v) {
      var y = ys(v, e1.max, P1);
      add(linha(PX0, y, PX1, y, BORDER, 1));
      add(txt(PX0 - 8, y + 3, br(v), { anc: 'end' }));
    });
    if (meta) {
      var ym = ys(meta, e1.max, P1);
      add(linha(PX0, ym, PX1, ym, INK, 1.5, '5 3'));
      add(txt(PX0 + 6, ym - 5, 'Meta ajustada ' + br(meta), { fs: 9, cor: INK, peso: 700 }));
      if (plano.meta_original) {
        add(txt(PX0 + 118, ym - 5, '(meta original ' + br(plano.meta_original) +
          ', sobre verba de ' + brl(plano.verba_plano, false) + ')'));
      }
    }
    var pts = acum.map(function (p) { return xd(p.ms).toFixed(1) + ',' + ys(p.v, e1.max, P1).toFixed(1); });
    add('<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + VIOL +
        '" stroke-width="2.5" stroke-linejoin="round"/>');

    var xc = xd(CORTE), yc = ys(totalLeads, e1.max, P1), XF = X(TOT);
    var alvosProj = [pv, pr].filter(function (v) { return v != null && isFinite(v); });
    if (temProj && alvosProj.length) {
      var alvos = alvosProj;
      alvos.forEach(function (v) {
        var yy = ys(v, e1.max, P1);
        add(linha(xc, yc, XF, yy, VIOL, 2, '4 3', 0.8));
        add('<circle cx="' + XF.toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="3.5" fill="#fff" stroke="' + VIOL + '" stroke-width="2"/>');
      });
      var lo = Math.min.apply(null, alvos), hi = Math.max.apply(null, alvos);
      var yt = ys(hi, e1.max, P1);
      var rot = lo === hi ? br(hi) : br(lo) + ' a ' + br(hi);
      add(txt(LBLX, yt - 19, rot, { fs: 8.5, cor: VIOL, peso: 700 }));
      add(txt(LBLX, yt - 10, 'gastando a verba toda', { fs: 8.5, cor: VIOL, peso: 700 }));
      add(txt(LBLX, yt - 1, 'ou mantendo o ritmo', { fs: 8.5, cor: VIOL, peso: 700 }));
    } else {
      add(txt(LBLX, yc + 3, br(totalLeads) + ' leads', { fs: 9.5, cor: VIOL, peso: 700 }));
      if (meta) add(txt(LBLX, yc + 13, pc(totalLeads / meta * 100) + ' da meta', { fs: 8.5 }));
    }
    add('<circle cx="' + xc.toFixed(1) + '" cy="' + yc.toFixed(1) + '" r="4" fill="' + VIOL + '" stroke="#fff" stroke-width="2"/>');

    // ---------- painel 2: leads por dia ----------
    add(txt(PX0 - 53, P2[0] - 9, 'Leads por dia', { fs: 9.5, cor: INK, peso: 700 }));
    add(txt(PX0 + 22, P2[0] - 9, 'barra o dia, linha a média de 7 dias'));
    add(linha(PX0, P2[1], PX1, P2[1], BORDER, 1));
    e2.passos.forEach(function (v) {
      if (!v) return;
      var y = ys(v, e2.max, P2);
      add(linha(PX0, y, PX1, y, BORDER, 1));
      add(txt(PX0 - 8, y + 3, br(v), { anc: 'end' }));
    });
    // Teto de largura: com janela de um dia TOT vale 1 e a barra ocupava o
    // painel inteiro, sugerindo volume que não existe e vazando pelos rótulos.
    var bw = Math.min(Math.max((PX1 - PX0) / TOT - 2.4, 2), 18);
    acum.forEach(function (p) {
      if (p.leads <= 0) return;
      var y = ys(p.leads, e2.max, P2);
      add('<rect x="' + (xd(p.ms) - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) +
          '" height="' + (P2[1] - y).toFixed(1) + '" rx="2" fill="' + VIOL + '" opacity="0.30"/>');
    });
    if (medValor != null && medValor > 0) {
      var ymed = ys(medValor, e2.max, P2);
      add(linha(PX0, ymed, PX1, ymed, MUTED, 1.5, '6 4'));
      add(txt(PX1 + 8, ymed + 3, 'mediana do curso ' + br(medValor), { fs: 8, cor: MUTED, peso: 700 }));
      if (med.turmas_base) {
        add(txt(PX1 + 8, ymed + 12, 'base de ' + br(med.turmas_base) +
              (Number(med.turmas_base) === 1 ? ' turma' : ' turmas'), { fs: 7.5, cor: MUTED }));
      }
    } else {
      add(txt(PX1 + 8, ys(e2.max * 0.62, e2.max, P2), 'sem histórico', { fs: 8, cor: MUTED, peso: 700 }));
      add(txt(PX1 + 8, ys(e2.max * 0.62, e2.max, P2) + 9, 'primeira turma do curso', { fs: 7.5, cor: MUTED }));
    }
    var mm = acum.map(function (_, i) {
      var jan7 = acum.slice(Math.max(0, i - 6), i + 1);
      var m = jan7.reduce(function (a, b) { return a + b.leads; }, 0) / jan7.length;
      return xd(acum[i].ms).toFixed(1) + ',' + ys(m, e2.max, P2).toFixed(1);
    });
    add('<polyline points="' + mm.join(' ') + '" fill="none" stroke="' + VIOL + '" stroke-width="2"/>');

    // ---------- painel 3: investimento por dia ----------
    add(txt(PX0 - 53, P3[0] - 9, 'Investimento por dia', { fs: 9.5, cor: INK, peso: 700 }));
    add(txt(PX0 + 53, P3[0] - 9, 'custo real: mídia + imposto Meta + assessoria'));
    add(linha(PX0, P3[1], PX1, P3[1], BORDER, 1));
    e3.passos.forEach(function (v) {
      if (!v) return;
      var y = ys(v, e3.max, P3);
      add(linha(PX0, y, PX1, y, BORDER, 1));
      add(txt(PX0 - 8, y + 3, br(v), { anc: 'end' }));
    });
    acum.forEach(function (p) {
      if (p.custo <= 0) return;
      var y = ys(p.custo, e3.max, P3);
      add('<rect x="' + (xd(p.ms) - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) +
          '" height="' + (P3[1] - y).toFixed(1) + '" rx="2" fill="' + TEAL + '" opacity="0.85"/>');
    });
    if (temProj && proj.teto_dia != null && Number(proj.teto_dia) > 0) {
      var yteto = ys(Number(proj.teto_dia), e3.max, P3);
      add(linha(xc, yteto, XF, yteto, TEAL, 1.5, '5 3'));
      // Ancorado no inicio do trecho projetado. Ancorar no fim do eixo jogava o
      // texto por cima das ultimas barras, porque ele e mais largo que a sobra.
      add(txt(xc + 4, yteto - 6, 'restam ' + brl(proj.teto_dia) + ' por dia até ' + dm(jan.campanha_fim),
        { cor: TEAL, peso: 700 }));
    }

    // ---------- eixo x ----------
    for (var t = INI; t <= FIM; t += DIA) {
      var dt = new Date(t), dd = dt.getUTCDate();
      if (dd === 1 || dd === 15 || t === INI) {
        var x = xd(t);
        add(linha(x, P3[1], x, P3[1] + 4, MUTED, 1));
        add(txt(x, P3[1] + 14, dm(dt.toISOString().slice(0, 10)), { anc: 'middle' }));
      }
    }
    if (CORTE < FIM) {
      // Rotular de "hoje" o último dia carregado escondia atraso de ingestão:
      // com a carga parada, a linha andava para trás e ninguém via.
      add(linha(xc, P1[0], xc, P3[1] + 4, MUTED, 1, '2 3'));
      // No pe do eixo o rotulo batia no marcador de data seguinte, porque
      // "dados ate 08/09" e bem mais largo que "hoje". Vai para o topo da
      // propria linha tracejada, onde a faixa esta livre.
      add(txt(xc + 4, P1[0] - 3, noDia ? 'hoje' : 'dados até ' + dm(jan.corte), { peso: 700 }));
    }

    // ---------- indicadores ----------
    var cpl = real.cpl_real == null ? null : Number(real.cpl_real);
    var cplP = plano.cpl_plano == null ? null : Number(plano.cpl_plano);
    var verba = plano.verba_oficial == null ? null : Number(plano.verba_oficial);
    var invest = Number(real.investimento || 0);
    var desvio = (cpl != null && cplP) ? (cpl / cplP - 1) * 100 : null;

    var k4;
    if (temProj && alvosProj.length) {
      var alvos2 = alvosProj;
      var lo2 = Math.min.apply(null, alvos2), hi2 = Math.max.apply(null, alvos2);
      k4 = ['ENTREGA PROJETADA', lo2 === hi2 ? br(hi2) : br(lo2) + ' a ' + br(hi2),
        meta ? (lo2 === hi2 ? pc(hi2 / meta * 100) + ' da meta'
                            : pc(lo2 / meta * 100) + ' a ' + pc(hi2 / meta * 100) + ' da meta') : 'sem meta definida'];
    } else if (fechada) {
      k4 = ['ENTREGA REALIZADA', meta ? pc(totalLeads / meta * 100) : br(totalLeads),
        meta ? 'da meta ajustada de ' + br(meta) : 'leads captados, sem meta definida'];
    } else {
      // Campanha no ar sem projeção (sem plano, sem verba ou sem CPL) não pode
      // dizer "realizada": ela não acabou.
      k4 = ['CAPTADO ATÉ AQUI', meta ? pc(totalLeads / meta * 100) : br(totalLeads),
        !inteira ? 'no período selecionado' : 'projeção indisponível: falta plano ou verba'];
    }
    var kpis = [
      ['LEADS CAPTADOS', br(totalLeads), dm(jan.ini) + ' a ' + dm(jan.corte)],
      ['INVESTIMENTO REAL', brl(invest),
        verba ? pc(invest / verba * 100) + ' da verba de ' + brl(verba, false) : 'sem verba registrada'],
      ['CPL REAL', cpl == null ? 'sem dado' : brl(cpl),
        cplP ? 'plano era ' + brl(cplP) + ' | ' + pc(Math.abs(desvio)) + (desvio >= 0 ? ' acima' : ' abaixo') : 'sem CPL de plano'],
      k4
    ];
    [75, 283, 491, 699].forEach(function (x, i) {
      var k = kpis[i];
      add('<rect x="' + x + '" y="110" width="186" height="3" fill="' + VIOL + '"/>');
      add(txt(x, 136, k[1], { fs: 19, cor: INK, peso: 700 }));
      add(txt(x, 148, k[0], { fs: 7.5 }));
      add(txt(x, 158, k[2], { fs: 7.5, cor: BODY }));
    });

    // ---------- leitura ----------
    var L1, L2;
    if (cpl == null || !cplP) {
      L1 = 'a campanha não tem CPL de plano registrado, então a comparação com o planejamento fica de fora.';
      L2 = 'Foram ' + br(totalLeads) + ' leads a ' + (cpl == null ? 'custo não apurado' : brl(cpl) + ' cada') +
           ', com ' + brl(invest, false) + ' investidos.';
    } else if (fechada) {
      L1 = 'o custo por lead fechou em ' + brl(cpl) + ' contra os ' + brl(cplP) + ' previstos no planejamento, ' +
           pc(Math.abs(desvio)) + (desvio >= 0 ? ' acima.' : ' abaixo.');
      L2 = verba && meta
        ? 'A campanha gastou ' + pc(invest / verba * 100) + ' da verba de ' + brl(verba, false) + ' e entregou ' +
          br(totalLeads) + ' leads, ' + pc(totalLeads / meta * 100) + ' da meta ajustada de ' + br(meta) + '.'
        : 'A campanha entregou ' + br(totalLeads) + ' leads com ' + brl(invest, false) + ' investidos.';
    } else if (!inteira) {
      L1 = 'no período selecionado o custo por lead ficou em ' + brl(cpl) + ' contra os ' +
           brl(cplP) + ' previstos, ' + pc(Math.abs(desvio)) + (desvio >= 0 ? ' acima.' : ' abaixo.');
      L2 = 'São ' + br(totalLeads) + ' leads e ' + brl(invest, false) + ' investidos entre ' +
           dm(jan.ini) + ' e ' + dm(jan.corte) +
           '. Este recorte não fecha a campanha, então não há projeção.';
    } else {
      L1 = 'o custo por lead está em ' + brl(cpl) + ' contra os ' + brl(cplP) + ' previstos, ' +
           pc(Math.abs(desvio)) + (desvio >= 0 ? ' acima do planejamento.' : ' abaixo do planejamento.');
      L2 = (pv != null && verba && meta)
        ? 'Nesse custo, a verba de ' + brl(verba, false) + ' compra ' + br(pv) + ' leads, ' +
          pc(pv / meta * 100) + ' da meta ajustada de ' + br(meta) + ', com ' +
          brl(real.verba_restante, false) + ' por investir em ' + jan.dias_restantes + ' dias.'
        : 'Foram ' + br(totalLeads) + ' leads ate aqui, com ' + brl(invest, false) + ' investidos.';
    }
    add('<rect x="75" y="462" width="810" height="50" fill="' + SURF + '"/>');
    add('<rect x="75" y="462" width="5" height="50" fill="' + VIOL + '"/>');
    add(txt(94, 482, 'Leitura:', { fs: 9.5, cor: INK, peso: 700 }));
    add(txt(139, 482, L1, { fs: 9.5, cor: BODY }));
    add(txt(94, 497, L2, { fs: 9.5, cor: BODY }));

    var sub = (inteira ? 'Captação x investimento | campanha de '
                       : 'Captação x investimento | recorte dentro da campanha de ') +
      dm(jan.campanha_ini) + ' a ' + dmy(jan.campanha_fim) +
      (inteira ? '' : ', vendo ' + dm(jan.ini) + ' a ' + dm(jan.corte)) +
      (verba ? ' | verba oficial de ' + brl(verba, false) : '') +
      (meta ? ' | meta ajustada a ' + br(meta) + ' leads' : '');

    var pontos = acum.map(function (p) {
      return { x: xd(p.ms), dia: new Date(p.ms).toISOString().slice(0, 10),
               leads: p.leads, custo: p.custo, acum: p.v };
    });

    host.innerHTML =
      '<svg class="g-campanha" viewBox="0 0 960 540" xmlns="' + NS + '" role="img" aria-labelledby="gcT gcD">' +
      '<title id="gcT">' + esc(camp.curso + ': captação x investimento') + '</title>' +
      '<desc id="gcD">' + esc(
        br(totalLeads) + ' leads captados de ' + dm(jan.ini) + ' a ' + dm(jan.corte) + '. ' +
        'Investimento real de ' + brl(invest) + (verba ? ' sobre verba de ' + brl(verba, false) : '') + '. ' +
        'CPL real de ' + (cpl == null ? 'nao apurado' : brl(cpl)) +
        (cplP ? ', contra ' + brl(cplP) + ' do plano' : '') + '. ' +
        (meta ? 'Meta ajustada de ' + br(meta) + ' leads. ' : '') + L1 + ' ' + L2) + '</desc>' +
      '<rect x="0" y="0" width="960" height="540" fill="#fff"/>' +
      txt(75, 70, camp.curso, { fs: 24, cor: PRIM, peso: 700 }) +
      txt(75, 92, sub, { fs: 12, cor: BODY }) +
      s.join('\n') +
      '</svg>';

    if (typeof host.querySelector === 'function') ligarTooltip(host, pontos, P1[0], P3[1]);
  }

  // Tooltip sobre o dia inteiro, nao sobre a barra: a barra de um dia fraco tem
  // poucos pixels de altura e seria quase impossivel de acertar com o mouse.
  function ligarTooltip(host, pontos, topo, base) {
    var svg = host.querySelector('svg');
    if (!svg || !pontos.length) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    var tt = document.createElement('div');
    tt.className = 'g-tt';
    tt.setAttribute('aria-hidden', 'true');
    host.appendChild(tt);

    var guia = document.createElementNS(NS, 'line');
    guia.setAttribute('y1', topo); guia.setAttribute('y2', base);
    guia.setAttribute('stroke', INK); guia.setAttribute('stroke-width', '1');
    guia.setAttribute('stroke-dasharray', '3 3');
    guia.setAttribute('opacity', '0');
    guia.setAttribute('pointer-events', 'none');
    svg.appendChild(guia);

    function esconder() { tt.style.opacity = 0; guia.setAttribute('opacity', '0'); }

    svg.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect();
      if (!r.width) return;
      var xSvg = (e.clientX - r.left) / r.width * 960;
      var melhor = 0, dist = 1e9;
      for (var i = 0; i < pontos.length; i++) {
        var dd = Math.abs(pontos[i].x - xSvg);
        if (dd < dist) { dist = dd; melhor = i; }
      }
      if (dist > 14) { esconder(); return; }
      var p = pontos[melhor];
      guia.setAttribute('x1', p.x); guia.setAttribute('x2', p.x); guia.setAttribute('opacity', '1');
      tt.innerHTML = '<b>' + dmy(p.dia) + '</b>' +
        '<div class="l"><i style="background:' + VIOL + '"></i>' + br(p.leads) + ' leads no dia</div>' +
        '<div class="l"><i style="background:' + TEAL + '"></i>' + brl(p.custo) + ' investidos</div>' +
        '<div class="l acum">' + br(p.acum) + ' leads acumulados</div>';
      tt.style.left = (p.x / 960 * r.width) + 'px';
      tt.style.top = (topo / 540 * r.height) + 'px';
      tt.style.opacity = 1;
    });
    svg.addEventListener('mouseleave', esconder);
  }

  window.GraficoCampanha = { desenha: desenha, escala: escala };
})();
