// Carga diária da mídia paga: lê a planilha Campanhas_Vanzolini_Consolidado
// (gviz CSV) e grava em midia_diaria por upsert, numa janela móvel de dias.
//
// A janela móvel existe porque as plataformas reescrevem os dias recentes
// (janela de atribuição). Recarregar sempre os últimos N dias corrige os
// números sem depender de a linha ter chegado certa na primeira vez.
//
// Autenticação: header x-carga-token, conferido contra o Vault. A função é
// pública (verify_jwt off) porque quem chama é o pg_cron, que não tem JWT.

const PLANILHA = "1ViMn-B5fwnL19SfFT74ZJc7r9lWvPJayk5MwoNPgSMQ";
const DIAS_JANELA_PADRAO = 14;
const DIAS_JANELA_MAX = 400;

// google_organizacoes fica fora de propósito: é cópia idêntica de google_mba
// e carregar as duas dobraria o Google (ver sql/fase_a_midia_20260725.md).
const ABAS = [
  { aba: "meta_todas", plataforma: "Meta", conta: "cursos" },
  { aba: "meta_mba", plataforma: "Meta", conta: "mba" },
  { aba: "meta_organizacoes", plataforma: "Meta", conta: "organizacoes" },
  { aba: "google_mba", plataforma: "Google", conta: "mba" },
  { aba: "google_todas", plataforma: "Google", conta: "institucional" },
  { aba: "linkedin_todas", plataforma: "LinkedIn", conta: "cursos" },
  { aba: "linkedin_mba", plataforma: "LinkedIn", conta: "mba" },
  { aba: "linkedin_organizacoes", plataforma: "LinkedIn", conta: "organizacoes" },
];

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const KEY_SB = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else { aspas = false; }
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

// Meta grava "45,43"; Google e LinkedIn gravam "45.43". Só trata como
// separador de milhar quando existe vírgula decimal na mesma string.
function num(s: string | undefined): number {
  if (!s) return 0;
  let t = s.trim();
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const v = Number(t);
  return Number.isFinite(v) ? v : 0;
}

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(new Date());
}

function menosDias(iso: string, dias: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

async function rpc(nome: string, corpo: unknown): Promise<unknown> {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: KEY_SB,
      Authorization: `Bearer ${KEY_SB}`,
    },
    body: JSON.stringify(corpo),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`rpc ${nome} falhou (${r.status}): ${txt.slice(0, 400)}`);
  return txt ? JSON.parse(txt) : null;
}

async function registraErro(detalhe: string, desde: string, ate: string, origem: string) {
  try {
    await fetch(`${URL_SB}/rest/v1/midia_carga_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: KEY_SB,
        Authorization: `Bearer ${KEY_SB}`,
      },
      body: JSON.stringify({
        origem, desde, ate, status: "erro", detalhe: detalhe.slice(0, 2000),
      }),
    });
  } catch { /* log é best-effort: não pode mascarar o erro original */ }
}

Deno.serve(async (req: Request) => {
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const token = req.headers.get("x-carga-token") ?? "";
  if (!token || !(await rpc("carga_token_valido", { p_token: token }))) {
    return json({ erro: "token invalido" }, 401);
  }

  let dias = DIAS_JANELA_PADRAO;
  let origem = "cron";
  try {
    const b = await req.json();
    if (b && typeof b.dias === "number") dias = Math.min(Math.max(1, b.dias), DIAS_JANELA_MAX);
    if (b && typeof b.origem === "string") origem = b.origem.slice(0, 40);
  } catch { /* sem corpo: usa o padrão */ }

  const ate = hojeSaoPaulo();
  const desde = menosDias(ate, dias);

  try {
    const acc = new Map<string, {
      data: string; plataforma: string; conta: string; campanha: string;
      impressoes: number; cliques: number; custo: number; leads: number;
    }>();

    // Sequencial de propósito: mantém o pico de memória baixo, já que a
    // meta_todas sozinha passa de 2 MB de texto.
    for (const { aba, plataforma, conta } of ABAS) {
      const url = `https://docs.google.com/spreadsheets/d/${PLANILHA}` +
        `/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(aba)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`aba ${aba}: HTTP ${r.status}`);
      const texto = await r.text();
      // Planilha fora do ar ou sem permissão devolve HTML, não CSV.
      if (texto.trimStart().startsWith("<")) throw new Error(`aba ${aba}: resposta nao e CSV`);

      for (const l of parseCsv(texto)) {
        if (l.length < 7) continue;
        const data = (l[0] ?? "").trim();
        if (!data.startsWith("20") || data < desde || data > ate) continue;
        const campanha = (l[1] ?? "").trim();
        if (!campanha) continue;

        const k = `${data}|${plataforma}|${conta}|${campanha}`;
        const a = acc.get(k) ??
          { data, plataforma, conta, campanha, impressoes: 0, cliques: 0, custo: 0, leads: 0 };
        // Soma os adsets/grupos: no banco a linha é por campanha, não por grupo.
        a.impressoes += Math.round(num(l[3]));
        a.cliques += Math.round(num(l[4]));
        a.custo += num(l[5]);
        a.leads += Math.round(num(l[6]));
        acc.set(k, a);
      }
    }

    const linhas = [...acc.values()].map((r) => ({
      ...r, custo: Number(r.custo.toFixed(6)),
    }));

    if (!linhas.length) {
      throw new Error(`nenhuma linha entre ${desde} e ${ate}; a planilha pode ter parado de atualizar`);
    }

    const res = await rpc("carrega_midia_lote", {
      p_rows: linhas, p_desde: desde, p_ate: ate, p_origem: origem,
    });
    return json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await registraErro(msg, desde, ate, origem);
    return json({ ok: false, erro: msg, desde, ate }, 500);
  }
});
