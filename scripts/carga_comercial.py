#!/usr/bin/env python3
"""Gera o INSERT de comercial_turma a partir da planilha GESTÃO VANZOLINI.

A planilha é compartilhada, não pública: o export anônimo do Google devolve 401.
Baixe pelo conector do Drive (o export CSV só traz a PRIMEIRA aba; para a
Comercial_Status é preciso exportar como xlsx) e rode:

    python3 scripts/carga_comercial.py gestao.xlsx cursos.txt > carga.sql

`cursos.txt` é `select string_agg(id||'§'||nome,'¶' order by id) from cursos`.
O SQL de saída é idempotente (on conflict do update pela sigla + turma).
"""
import sys, re, datetime, unicodedata
import openpyxl

CORTE = datetime.date(2026, 5, 1)   # antes disso o histórico vem de `turmas`

def norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', s.lower())

# variações de nome do mesmo curso, conferidas à mão em 07/09/2026
DEPARA = {
    "Interpretação dos Requisitos ISO 9001": 33,
    "Atualização Novo Manual OPSS ONA - 2026/2029": 46,
    "ISO/IEC 27701:2025 – Interpretação dos requisitos da nova versão independente": 109,
    "Gestão de Operações": 28,
}

def inteiro(v):
    if v in (None, ""): return "null"
    try: return str(int(float(str(v).replace(".", "").replace(",", "."))))
    except ValueError: return "null"

def decimal(v):
    if v in (None, ""): return "null"
    if isinstance(v, (int, float)): return repr(round(float(v), 2))
    t = re.sub(r"[^\d,.-]", "", str(v))
    t = t.replace(".", "").replace(",", ".") if (t.count(",") == 1 and t.rfind(",") > t.rfind(".")) else t.replace(",", "")
    try: return repr(round(float(t), 2))
    except ValueError: return "null"

def main(xlsx, cursos_txt):
    cursos = {}
    for p in open(cursos_txt, encoding="utf-8").read().strip().split("¶"):
        i, n = p.split("§", 1)
        cursos[norm(n)] = int(i)
    depara = {norm(k): v for k, v in DEPARA.items()}

    ws = openpyxl.load_workbook(xlsx, data_only=True)["Comercial_Status"]
    linhas = list(ws.iter_rows(values_only=True))
    hdr = [str(c) if c is not None else "" for c in linhas[0]]
    ix = {h.strip(): i for i, h in enumerate(hdr)}
    col = lambda r, k: r[ix[k]] if k in ix and ix[k] < len(r) else None

    vals, sem_curso = [], []
    for r in linhas[1:]:
        d = col(r, "DATA INICIO")
        if not isinstance(d, datetime.datetime) or d.date() < CORTE:
            continue
        sigla = str(col(r, "SIGLA + TURMA") or "").strip()
        if not sigla:
            continue
        nn = norm(col(r, "NOME"))
        cid = cursos.get(nn) or depara.get(nn)
        if cid is None:
            sem_curso.append(str(col(r, "NOME")).strip())
        vals.append("('%s',%s,'%s',%s,%s,%s,%s,%s,%s,%s)" % (
            sigla.replace("'", "''"), cid or "null", d.date().isoformat(),
            inteiro(col(r, "INSCRITOS")), inteiro(col(r, "CANCELADOS")),
            inteiro(col(r, "BOLSISTAS")), inteiro(col(r, "PRÉ MAT.")),
            inteiro(col(r, "Matriculas pgtes")), decimal(col(r, "Vendas R$")),
            decimal(col(r, "R$"))))

    print("-- %d turmas desde %s; %d sem curso cadastrado" % (len(vals), CORTE, len(sem_curso)))
    for n in sorted(set(sem_curso)):
        print("--   sem curso: %s" % n)
    print("insert into comercial_turma(sigla_turma,curso_id,data_inicio,inscritos,"
          "cancelados,bolsistas,pre_matricula,pagantes,vendas,preco) values")
    print(",\n".join(vals))
    print("on conflict(sigla_turma) do update set curso_id=excluded.curso_id,"
          "data_inicio=excluded.data_inicio,inscritos=excluded.inscritos,"
          "cancelados=excluded.cancelados,bolsistas=excluded.bolsistas,"
          "pre_matricula=excluded.pre_matricula,pagantes=excluded.pagantes,"
          "vendas=excluded.vendas,preco=excluded.preco,carregado_em=now();")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
