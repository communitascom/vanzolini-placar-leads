#!/usr/bin/env python3
"""Gera INSERTs incrementais de midia_diaria a partir dos CSVs das abas.

Replica a carga original: 1 linha por data+plataforma+conta+campanha,
adsets/grupos somados. Corte: data > 2026-07-25 (nada novo em linkedin_mba).
curso_id e bloco ficam por conta do trigger trg_midia_diaria_preenche.
"""
import csv, os, sys
from collections import defaultdict

BASE = os.path.dirname(os.path.abspath(__file__))
CORTE = "2026-07-25"

ABAS = [
    ("meta_todas", "Meta", "cursos"),
    ("meta_mba", "Meta", "mba"),
    ("meta_organizacoes", "Meta", "organizacoes"),
    ("google_mba", "Google", "mba"),
    ("google_todas", "Google", "institucional"),
    ("linkedin_todas", "LinkedIn", "cursos"),
    ("linkedin_mba", "LinkedIn", "mba"),
    ("linkedin_organizacoes", "LinkedIn", "organizacoes"),
]

def num(s):
    s = (s or "").strip()
    if not s:
        return 0.0
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0

agg = defaultdict(lambda: [0, 0, 0.0, 0])  # impr, cliq, custo, leads
totais = {}
for aba, plat, conta in ABAS:
    n = 0
    with open(os.path.join(BASE, aba + ".csv"), newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            if len(row) < 7 or not row[0].startswith("20"):
                continue
            data = row[0].strip()
            if data <= CORTE:
                continue
            camp = row[1].strip()
            if not camp:
                continue
            k = (data, plat, conta, camp)
            a = agg[k]
            a[0] += int(num(row[3]))
            a[1] += int(num(row[4]))
            a[2] += num(row[5])
            a[3] += int(num(row[6]))
            n += 1
    totais[aba] = n

linhas = sorted(agg.items())
custo_total = sum(v[2] for _, v in linhas)
print(f"linhas brutas por aba: {totais}", file=sys.stderr)
print(f"linhas agregadas: {len(linhas)} | custo total: R$ {custo_total:,.2f}", file=sys.stderr)

def esc(s):
    return s.replace("'", "''")

BATCH = 250
os.makedirs(os.path.join(BASE, "inserts"), exist_ok=True)
for i in range(0, len(linhas), BATCH):
    chunk = linhas[i:i+BATCH]
    vals = ",\n".join(
        f"('{d}','{p}','{c}','{esc(camp)}',{v[0]},{v[1]},{v[2]:.6f},{v[3]})"
        for (d, p, c, camp), v in chunk
    )
    sql = ("insert into midia_diaria (data, plataforma, conta, campanha, impressoes, cliques, custo, leads_plataforma) values\n"
           + vals + ";")
    with open(os.path.join(BASE, "inserts", f"lote_{i//BATCH:02d}.sql"), "w") as f:
        f.write(sql)
print(f"lotes gravados em inserts/ ({(len(linhas)+BATCH-1)//BATCH})", file=sys.stderr)
