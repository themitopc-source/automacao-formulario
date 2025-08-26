\
import os, sqlite3, csv, io, json
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, abort

STORE_DIR = os.environ.get("STORE_DIR", "/data")
os.makedirs(STORE_DIR, exist_ok=True)
DB_PATH = os.path.join(STORE_DIR, "submissions.db")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")  # optional simple auth for exports

REQUIRED_FIELDS = [
    "classificacao","empresa","unidade","data","hora","turno","area",
    "setor","atividade","intervencao","cs","observacao","descricao","fiz"
]

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.execute("""
    CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        classificacao TEXT NOT NULL,
        empresa TEXT NOT NULL,
        unidade TEXT NOT NULL,
        data TEXT NOT NULL,
        hora TEXT NOT NULL,
        turno TEXT NOT NULL,
        area TEXT NOT NULL,
        setor TEXT NOT NULL,
        atividade TEXT NOT NULL,
        intervencao TEXT NOT NULL,
        cs INTEGER NOT NULL,
        observacao TEXT NOT NULL,
        descricao TEXT NOT NULL,
        fiz TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

def validate_payload(d):
    # All fields present and non-empty
    for f in REQUIRED_FIELDS:
        v = (d.get(f) or "").strip()
        if not v:
            return False, f"Campo obrigatório ausente: {f}"
    # CS numeric range
    try:
        cs = int(d["cs"])
        if not (10 <= cs <= 999_999_999):
            return False, "CS deve estar entre 10 e 999999999"
    except Exception:
        return False, "CS deve ser numérico"
    # Data formato dd/mm/aaaa (básico)
    try:
        datetime.strptime(d["data"], "%d/%m/%Y")
    except Exception:
        return False, "Data inválida (use dd/mm/aaaa)"
    # Hora HH:MM simples
    hhmm = d["hora"]
    if len(hhmm) not in (4,5) or ":" not in hhmm:
        return False, "Hora inválida (use HH:MM)"
    return True, None

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.post("/api/submit")
def api_submit():
    data = {k:(request.form.get(k) or "").strip() for k in REQUIRED_FIELDS}
    ok, err = validate_payload(data)
    if not ok:
        return jsonify({"ok": False, "detail": err}), 400
    conn = get_conn()
    conn.execute("""
        INSERT INTO submissions
        (created_at, classificacao, empresa, unidade, data, hora, turno, area, setor, atividade,
         intervencao, cs, observacao, descricao, fiz)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        datetime.utcnow().isoformat(),
        data["classificacao"], data["empresa"], data["unidade"], data["data"], data["hora"],
        data["turno"], data["area"], data["setor"], data["atividade"], data["intervencao"],
        int(data["cs"]), data["observacao"], data["descricao"], data["fiz"]
    ))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

def require_admin():
    if not ADMIN_TOKEN:
        return True
    token = request.args.get("token") or request.headers.get("X-Admin-Token") or ""
    return token == ADMIN_TOKEN

@app.get("/export.json")
def export_json():
    if not require_admin():
        abort(401)
    conn = get_conn()
    cur = conn.execute("SELECT * FROM submissions ORDER BY id DESC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return jsonify(rows)

@app.get("/export.csv")
def export_csv():
    if not require_admin():
        abort(401)
    conn = get_conn()
    cur = conn.execute("SELECT * FROM submissions ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()

    if not rows:
        return send_file(io.BytesIO(b""), mimetype="text/csv", as_attachment=True, download_name="submissions.csv")

    output = io.StringIO()
    writer = csv.writer(output)
    header = rows[0].keys()
    writer.writerow(header)
    for r in rows:
        writer.writerow([r[k] for k in header])
    mem = io.BytesIO(output.getvalue().encode("utf-8"))
    return send_file(mem, mimetype="text/csv", as_attachment=True, download_name="submissions.csv")

@app.get("/health")
def health():
    return "ok"

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "10000")), debug=False)
else:
    init_db()
