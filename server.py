
import os, json, traceback
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for
from playwright.sync_api import sync_playwright

# ---------- Persistence ----------
STORE_DIR = os.environ.get("STORE_DIR", "/data")
os.makedirs(STORE_DIR, exist_ok=True)
STORE_PATH = os.path.join(STORE_DIR, "saved_fields.json")

LICENSE_KEY_CONFIG = {"THEMITO": 30, "THEMITO10": 90}

OBSERVACOES = [
    "Condição estrutural do equipamento","Condição estrutural do local",
    "Construção civil","COVID","Descarte de lixo","Direção segura",
    "Elevação e movimentação de carga","Espaço Confinado","LOTO",
    "Meio Ambiente - Fumaça Preta","Meio Ambiente - Resíduos",
    "Meio Ambiente - Vazamentos","Meio Ambiente - Vinhaça",
    "Mov. cargas e interface Homem Máquina","Permissão de Serviços e procedimentos",
    "Regra dos três pontos","Segurança de processo (Aplicável na Indústria)",
    "Serviço elétrico","Serviços a quente","Trabalho em Altura",
    "Uso de EPIS","5S"
]

UNIDADES = [
    "Araraquara","Barra","Benalcool","Bonfim","Caarapó","Continental","Costa Pinto",
    "Destivale","Diamante","Dois Córregos","Gasa","Ipaussu","Jataí","Junqueira",
    "Lagoa da Prata","Leme","Maracaí","MB","Mundial","Paraguaçú","Paraíso",
    "Passa Tempo","Rafard","Rio Brilhante","Santa Cândida","Santa Elisa",
    "Santa Helena","São Francisco","Serra","Tarumã","Univalem","Vale do Rosário"
]

def load_store():
    if os.path.exists(STORE_PATH):
        try:
            with open(STORE_PATH, "r", encoding="utf-8") as f:
                d = json.load(f)
        except Exception:
            d = {}
    else:
        d = {}
    d.setdefault("setor", [])
    d.setdefault("atividade", [])
    d.setdefault("intervencao", [])
    d.setdefault("intervencao_cs_map", {})
    d.setdefault("observacao", OBSERVACOES[:1])
    d.setdefault("intervencao_counts", {})
    d.setdefault("last_values", {
        "classificacao": "Quase acidente",
        "empresa": "Raízen",
        "unidade": "Vale do Rosário",
        "data": datetime.now().strftime("%d/%m/%Y"),
        "hora": "08:00",
        "turno": "A",
        "area": "Adm",
        "setor": "",
        "atividade": "",
        "intervencao": "",
        "cs": "",
        "observacao": OBSERVACOES[0],
        "descricao": "",
        "fiz": "",
        "form_url": "https://forms.office.com/Pages/ResponsePage.aspx?id=phHE5xOQZ0mlsT0I-e3BPm4ZyCW04uxHi5LaP7rueIFURFdHNDFISEZVSUc4MFc4TEJOWVpJSTRWOSQlQCN0PWcu",
    })
    d.setdefault("license_key", "")
    d.setdefault("license_expiry", "")
    return d

def save_store(d):
    with open(STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

def license_ok(d):
    try:
        if not d.get("license_key") or not d.get("license_expiry"):
            return False
        return datetime.fromisoformat(d["license_expiry"]) >= datetime.now()
    except Exception:
        return False

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    st = load_store()
    return render_template("index.html",
                           st=st,
                           obs_opts=OBSERVACOES,
                           unidades=UNIDADES,
                           hora_opts=[f"{h:02d}:{m:02d}" for h in range(24) for m in (0,30)],
                           areas=["Adm","Agr","Alm","Aut","Biogás","E2G","Ind"],
                           lic_ok=license_ok(st))

@app.post("/license/validate")
def validate_license():
    st = load_store()
    key = (request.form.get("key") or "").strip().upper()
    days = LICENSE_KEY_CONFIG.get(key)
    if not days:
        return jsonify({"ok": False, "detail": "Chave inválida"}), 400
    expiry = (datetime.now() + timedelta(days=days)).isoformat()
    st["license_key"] = key
    st["license_expiry"] = expiry
    save_store(st)
    return jsonify({"ok": True, "expires": expiry})

@app.post("/delete_value")
def delete_value():
    st = load_store()
    field = request.form.get("field")
    value = request.form.get("value", "")
    if field not in {"setor","atividade","intervencao"}:
        return jsonify({"ok": False, "detail": "Campo inválido"}), 400

    if field == "intervencao":
        if value in st["intervencao"]:
            st["intervencao"].remove(value)
        st["intervencao_cs_map"].pop(value, None)
        st["intervencao_counts"].pop(value, None)
    else:
        lst = st[field]
        if value in lst:
            lst.remove(value)

    save_store(st)
    return jsonify({"ok": True})

def fill_form(page, dados):
    # Espera a primeira pergunta aparecer
    page.wait_for_selector("xpath=//*[@id='question-list']/div[1]//div[@role='button']")

    # 1 Classificação
    page.locator("xpath=//*[@id='question-list']/div[1]//div[@role='button']").first.click()
    opts = page.locator("span[aria-label]")
    for i in range(opts.count()):
        if opts.nth(i).get_attribute("aria-label") == dados["classificacao"]:
            opts.nth(i).click(); break

    # 2 Empresa
    page.locator("xpath=//*[@id='question-list']/div[2]//div[@role='button']").first.click()
    opts = page.locator("span[aria-label]")
    for i in range(opts.count()):
        if opts.nth(i).get_attribute("aria-label") == dados["empresa"]:
            opts.nth(i).click(); break

    # 3 Unidade
    page.locator("xpath=//*[@id='question-list']/div[3]//div[@role='button']").first.click()
    opts = page.locator("span[aria-label]")
    for i in range(opts.count()):
        if opts.nth(i).get_attribute("aria-label") == dados["unidade"]:
            opts.nth(i).click(); break

    # 4 Data
    page.locator("xpath=//*[@id='question-list']/div[4]//input").fill(dados["data"])

    # 5 Hora
    page.locator("xpath=//*[@id='question-list']/div[5]//div[@role='button']").click()
    opts = page.locator("span[aria-label]")
    for i in range(opts.count()):
        if opts.nth(i).get_attribute("aria-label") == dados["hora"]:
            opts.nth(i).click(); break

    # 6 Turno
    page.locator("xpath=//*[@id='question-list']/div[6]//div[@role='button']").click()
    opts = page.locator("span[aria-label]")
    for i in range(opts.count()):
        if opts.nth(i).get_attribute("aria-label") == dados["turno"]:
            opts.nth(i).click(); break

    # 7 Área
    page.locator("xpath=//*[@id='question-list']/div[7]//div[@role='button']").click()
    opts = page.locator("span[aria-label]")
    for i in range(opts.count()):
        if opts.nth(i).get_attribute("aria-label") == dados["area"]:
            opts.nth(i).click(); break

    # 8,9,10,11
    page.locator("xpath=//*[@id='question-list']/div[8]//input").fill(dados["setor"])
    page.locator("xpath=//*[@id='question-list']/div[9]//input").fill(dados["atividade"])
    page.locator("xpath=//*[@id='question-list']/div[10]//input").fill(dados["intervencao"])
    page.locator("xpath=//*[@id='question-list']/div[11]//input").fill(str(dados["cs"]))

    # 12 Observação
    page.locator("xpath=//*[@id='question-list']/div[12]//div[@role='button']").click()
    opts = page.locator("span[aria-label]")
    for i in range(opts.count()):
        if opts.nth(i).get_attribute("aria-label") == dados["observacao"]:
            opts.nth(i).click(); break

    # 13 / 14
    page.locator("xpath=//*[@id='question-list']/div[13]//textarea | //*[@id='question-list']/div[13]//input").fill(dados["descricao"])
    page.locator("xpath=//*[@id='question-list']/div[14]//textarea | //*[@id='question-list']/div[14]//input").fill(dados["fiz"])

    # Submeter
    # Alguns forms usam 'Enviar', outros 'Submeter'
    submit_btn = page.locator("button:has-text('Enviar')")
    if submit_btn.count() == 0:
        submit_btn = page.locator(\"button:has-text('Submeter')\")
    submit_btn.click()

@app.post("/send")
def send_once():
    st = load_store()
    if not license_ok(st):
        return jsonify({"ok": False, "detail": "Licença inválida/expirada"}), 403

    form = request.form
    try:
        dados = {
            "form_url": form.get("form_url").strip(),
            "classificacao": form.get("classificacao").strip(),
            "empresa": form.get("empresa").strip(),
            "unidade": form.get("unidade").strip(),
            "data": form.get("data").strip(),
            "hora": form.get("hora").strip(),
            "turno": form.get("turno").strip(),
            "area": form.get("area").strip(),
            "setor": form.get("setor").strip(),
            "atividade": form.get("atividade").strip(),
            "intervencao": form.get("intervencao").strip(),
            "cs": int(form.get("cs").strip()),
            "observacao": form.get("observacao").strip(),
            "descricao": form.get("descricao").strip(),
            "fiz": form.get("fiz").strip(),
        }
        if not (10 <= dados["cs"] <= 999_999_999):
            return jsonify({"ok": False, "detail": "CS deve estar entre 10 e 999999999"}), 400

        # Persist last values and lists
        st["last_values"] = dados.copy()
        st["last_values"].pop("form_url", None)  # guardamos abaixo
        st["last_values"]["form_url"] = dados["form_url"]
        if dados["setor"] and dados["setor"] not in st["setor"]:
            st["setor"].append(dados["setor"])
        if dados["atividade"] and dados["atividade"] not in st["atividade"]:
            st["atividade"].append(dados["atividade"])
        if dados["intervencao"]:
            if dados["intervencao"] not in st["intervencao"]:
                st["intervencao"].append(dados["intervencao"])
            st["intervencao_cs_map"][dados["intervencao"]] = str(dados["cs"])
            st["intervencao_counts"][dados["intervencao"]] = st["intervencao_counts"].get(dados["intervencao"], 0) + 1
        st["observacao"] = [dados["observacao"]]
        save_store(st)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(dados["form_url"])
            fill_form(page, dados)
            # Após enviar, tentar voltar para 'Enviar outra resposta' apenas para consistência
            try:
                page.locator("text=Enviar outra resposta").click()
            except Exception:
                pass
            browser.close()

        return jsonify({"ok": True, "count": st["intervencao_counts"].get(dados["intervencao"], 0)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "detail": f"Erro: {e}"}), 500

@app.post("/send10")
def send_ten():
    st = load_store()
    if not license_ok(st):
        return jsonify({"ok": False, "detail": "Licença inválida/expirada"}), 403

    form = request.form
    try:
        base_data = datetime.strptime(form.get("data").strip(), "%d/%m/%Y")
        dados = {
            "form_url": form.get("form_url").strip(),
            "classificacao": form.get("classificacao").strip(),
            "empresa": form.get("empresa").strip(),
            "unidade": form.get("unidade").strip(),
            "hora": form.get("hora").strip(),
            "turno": form.get("turno").strip(),
            "area": form.get("area").strip(),
            "setor": form.get("setor").strip(),
            "atividade": form.get("atividade").strip(),
            "intervencao": form.get("intervencao").strip(),
            "cs": int(form.get("cs").strip()),
            "observacao": form.get("observacao").strip(),
            "descricao": form.get("descricao").strip(),
            "fiz": form.get("fiz").strip(),
        }
        if not (10 <= dados["cs"] <= 999_999_999):
            return jsonify({"ok": False, "detail": "CS deve estar entre 10 e 999999999"}), 400

        # Persist basics
        st["last_values"].update({k: v for k, v in dados.items() if k != "form_url"})
        st["last_values"]["form_url"] = dados["form_url"]
        if dados["setor"] and dados["setor"] not in st["setor"]:
            st["setor"].append(dados["setor"])
        if dados["atividade"] and dados["atividade"] not in st["atividade"]:
            st["atividade"].append(dados["atividade"])
        if dados["intervencao"]:
            if dados["intervencao"] not in st["intervencao"]:
                st["intervencao"].append(dados["intervencao"])
            st["intervencao_cs_map"][dados["intervencao"]] = str(dados["cs"])
        st["observacao"] = [dados["observacao"]]
        save_store(st)

        sent = 0
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(dados["form_url"])
            for i in range(10):
                d = base_data - timedelta(days=i)
                dados_round = dados.copy()
                dados_round["data"] = d.strftime("%d/%m/%Y")
                fill_form(page, dados_round)
                sent += 1
                # após enviar, clicar em 'Enviar outra resposta' para recomeçar na mesma aba
                page.locator("text=Enviar outra resposta").click()
                page.wait_for_selector("xpath=//*[@id='question-list']/div[1]//div[@role='button']")

        # atualizar contadores
        if dados["intervencao"]:
            st = load_store()
            st["intervencao_counts"][dados["intervencao"]] = st["intervencao_counts"].get(dados["intervencao"], 0) + sent
            save_store(st)

        return jsonify({"ok": True, "sent": sent, "count": st["intervencao_counts"].get(dados['intervencao'], 0)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"ok": False, "detail": f"Erro: {e}"}), 500

@app.get("/saved")
def get_saved():
    st = load_store()
    return jsonify(st)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
