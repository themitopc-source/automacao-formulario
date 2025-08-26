import customtkinter as ctk
from tkinter import ttk
from datetime import datetime, timedelta
import threading
from playwright.sync_api import sync_playwright
import json
import os

# Configurações visuais
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# Arquivo de persistência
storage_file = "saved_fields.json"

# Chaves fixas: "TheMito" -> 30 dias, "TheMito10" -> 90 dias
LICENSE_KEY_CONFIG = {
    "THEMITO": 30,      # 30 dias
    "THEMITO10": 90     # 90 dias (3 meses)
}

# Lista fixa de observações
opcoes_observacao = [
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

def load_saved_values():
    if os.path.exists(storage_file):
        try:
            with open(storage_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {}
    else:
        data = {}
    data.setdefault("setor", [])
    data.setdefault("atividade", [])
    data.setdefault("intervencao", [])
    data.setdefault("intervencao_cs_map", {})
    data.setdefault("observacao", [])
    data.setdefault("intervencao_counts", {})
    data.setdefault("last_values", {})
    data.setdefault("license_key", "")
    data.setdefault("license_expiry", "")
    return data

def save_values(values):
    with open(storage_file, "w", encoding="utf-8") as f:
        json.dump(values, f, ensure_ascii=False, indent=4)

saved_values = load_saved_values()

def is_license_valid():
    key = saved_values.get("license_key")
    expiry = saved_values.get("license_expiry")
    if key and expiry:
        try:
            return datetime.now() <= datetime.fromisoformat(expiry)
        except Exception:
            return False
    return False

# Janela
janela = ctk.CTk()
janela.title("Automatizador de Formulários Raízen")
janela.geometry("900x1450")

def safe_log(msg):
    janela.after(0, lambda: log_box.insert("end", msg))

# Atualiza contagem
def update_intervencao_count_display(name):
    count = saved_values["intervencao_counts"].get(name, 0)
    color = "#FF0000" if count < 20 else "#00CC00"
    label_intervencao_count.configure(text=str(count), text_color=color)

# Cabeçalho
ctk.CTkLabel(janela, text="Automatizador de Formulários - Raízen",
             font=("Arial", 20, "bold")).pack(pady=20)

# Painel de licença
license_frame = ctk.CTkFrame(janela)
license_frame.pack(pady=10)
license_msg = ctk.CTkLabel(license_frame, text="Insira a chave de acesso:")
license_entry = ctk.CTkEntry(license_frame, width=250, fg_color="#ECEEF0", text_color="black")
def validate_key():
    key = license_entry.get().strip().upper()
    if key in LICENSE_KEY_CONFIG:
        days = LICENSE_KEY_CONFIG[key]
        expiry = datetime.now() + timedelta(days=days)
        saved_values["license_key"] = key
        saved_values["license_expiry"] = expiry.isoformat()
        save_values(saved_values)
        license_msg.configure(text=f"Chave válida! Expira em {expiry.date()}", text_color="#00CC00")
        disable_form(False)
    else:
        license_msg.configure(text="Chave inválida.", text_color="#FF5555")
        disable_form(True)
ctk.CTkButton(license_frame, text="Validar Chave", command=validate_key).pack(side="right", padx=5)
license_msg.pack(side="left", padx=5)
license_entry.pack(side="left", padx=5)

# Painel principal
main_frame = ctk.CTkFrame(janela, corner_radius=8)
main_frame.pack(padx=40, pady=10, fill="both")

# Helper para criar linha
def create_row(label_text, widget, row):
    lbl = ctk.CTkLabel(main_frame, text=label_text)
    lbl.grid(row=row, column=0, sticky="e", padx=(0,10), pady=4)
    widget.grid(row=row, column=1, sticky="w", pady=4)

# --- Campos 1 a 14 com persistência ---
# 1. Classificação
combo_classificacao = ttk.Combobox(main_frame, values=[
    "Quase acidente","Comportamento inseguro","Condição insegura"],
    state="readonly", width=30)
combo_classificacao.set(saved_values["last_values"].get("classificacao","Quase acidente"))
create_row("1. Classificação", combo_classificacao, 0)

# 2. Empresa
combo_empresa = ttk.Combobox(main_frame, values=["Raízen","Contratada"],
                             state="readonly", width=30)
combo_empresa.set(saved_values["last_values"].get("empresa","Raízen"))
create_row("2. Empresa", combo_empresa, 1)

# 3. Unidade
opcoes_unidade = [
    "Araraquara","Barra","Benalcool","Bonfim","Caarapó","Continental","Costa Pinto",
    "Destivale","Diamante","Dois Córregos","Gasa","Ipaussu","Jataí","Junqueira",
    "Lagoa da Prata","Leme","Maracaí","MB","Mundial","Paraguaçú","Paraíso",
    "Passa Tempo","Rafard","Rio Brilhante","Santa Cândida","Santa Elisa",
    "Santa Helena","São Francisco","Serra","Tarumã","Univalem","Vale do Rosário"
]
combo_unidade = ttk.Combobox(main_frame, values=opcoes_unidade,
                             state="readonly", width=30)
combo_unidade.set(saved_values["last_values"].get("unidade","Vale do Rosário"))
create_row("3. Unidade", combo_unidade, 2)

# 4. Data
entrada_data = ctk.CTkEntry(main_frame, width=120, fg_color="white", text_color="black")
entrada_data.insert(0, saved_values["last_values"].get("data", datetime.now().strftime("%d/%m/%Y")))
create_row("4. Data", entrada_data, 3)

# 5. Hora
combo_hora = ttk.Combobox(main_frame, values=[
    "00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30",
    "05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30",
    "10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
    "15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
    "20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"
], state="readonly", width=30)
combo_hora.set(saved_values["last_values"].get("hora","08:00"))
create_row("5. Hora", combo_hora, 4)

# 6. Turno
combo_turno = ttk.Combobox(main_frame, values=["A","B","C"],
                           state="readonly", width=30)
combo_turno.set(saved_values["last_values"].get("turno","A"))
create_row("6. Turno", combo_turno, 5)

# 7. Área
combo_area = ttk.Combobox(main_frame, values=["Adm","Agr","Alm","Aut","Biogás","E2G","Ind"],
                          state="readonly", width=30)
combo_area.set(saved_values["last_values"].get("area","Adm"))
create_row("7. Área", combo_area, 6)

# 8. Setor (subframe)
setor_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
combo_setor = ttk.Combobox(setor_frame, width=30)
combo_setor["values"] = saved_values["setor"]
combo_setor.set(saved_values["last_values"].get("setor", saved_values["setor"][-1] if saved_values["setor"] else ""))
combo_setor.pack(side="left")
def rem_setor():
    name = combo_setor.get()
    if name in saved_values["setor"]:
        saved_values["setor"].remove(name)
        save_values(saved_values)
        combo_setor["values"] = saved_values["setor"]
        combo_setor.set("")
        safe_log(f"✅ Setor '{name}' removido\n")
ctk.CTkButton(setor_frame, text="X", width=25, height=25, command=rem_setor).pack(side="left", padx=(5,0))
create_row("8. Setor", setor_frame, 7)

# 9. Atividade (subframe)
atividade_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
combo_atividade = ttk.Combobox(atividade_frame, width=30)
combo_atividade["values"] = saved_values["atividade"]
combo_atividade.set(saved_values["last_values"].get("atividade", saved_values["atividade"][-1] if saved_values["atividade"] else ""))
combo_atividade.pack(side="left")
def rem_atividade():
    name = combo_atividade.get()
    if name in saved_values["atividade"]:
        saved_values["atividade"].remove(name)
        save_values(saved_values)
        combo_atividade["values"] = saved_values["atividade"]
        combo_atividade.set("")
        safe_log(f"✅ Atividade '{name}' removida\n")
ctk.CTkButton(atividade_frame, text="X", width=25, height=25, command=rem_atividade).pack(side="left", padx=(5,0))
create_row("9. Atividade", atividade_frame, 8)

# 10. Intervenção (subframe com contador e X)
interv_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
combo_intervencao = ttk.Combobox(interv_frame, width=30)
combo_intervencao["values"] = saved_values["intervencao"]
combo_intervencao.set(saved_values["last_values"].get("intervencao",""))
combo_intervencao.pack(side="left")
label_intervencao_count = ctk.CTkLabel(interv_frame, text="", width=30)
label_intervencao_count.pack(side="left", padx=(5,0))
def rem_interv():
    name = combo_intervencao.get()
    if name in saved_values["intervencao"]:
        saved_values["intervencao"].remove(name)
        saved_values["intervencao_cs_map"].pop(name, None)
        saved_values["intervencao_counts"].pop(name, None)
        save_values(saved_values)
        combo_intervencao["values"] = saved_values["intervencao"]
        combo_intervencao.set("")
        entrada_cs.delete(0, 'end')
        update_intervencao_count_display("")
        safe_log(f"✅ Intervenção '{name}' removida\n")
ctk.CTkButton(interv_frame, text="X", width=25, height=25, command=rem_interv).pack(side="left", padx=(5,0))
def on_interv_select(event=None):
    name = combo_intervencao.get()
    if name in saved_values["intervencao_cs_map"]:
        entrada_cs.delete(0,'end')
        entrada_cs.insert(0, saved_values["intervencao_cs_map"][name])
    update_intervencao_count_display(name)
combo_intervencao.bind("<<ComboboxSelected>>", on_interv_select)
combo_intervencao.bind("<KeyRelease>", on_interv_select)
create_row("10. Intervenção", interv_frame, 9)
update_intervencao_count_display(combo_intervencao.get())

# 11. CS
entrada_cs = ctk.CTkEntry(main_frame, width=250,
    placeholder_text="Digite um número entre 10 e 999999999",
    fg_color="white", text_color="black")
entrada_cs.insert(0, saved_values["last_values"].get("cs",""))
create_row("11. CS", entrada_cs, 10)

# 12. Observação
combo_observacao = ttk.Combobox(main_frame, values=opcoes_observacao,
    state="readonly", width=40)
combo_observacao.set(saved_values["last_values"].get("observacao", opcoes_observacao[0]))
create_row("12. Observação", combo_observacao, 11)

# 13. Descrição
entrada_descricao = ctk.CTkEntry(main_frame, width=400,
    placeholder_text="introduza a sua resposta",
    fg_color="white", text_color="black")
entrada_descricao.insert(0, saved_values["last_values"].get("descricao",""))
create_row("13. Descrição", entrada_descricao, 12)

# 14. Fiz
entrada_fiz = ctk.CTkEntry(main_frame, width=400,
    placeholder_text="introduza a sua resposta",
    fg_color="white", text_color="black")
entrada_fiz.insert(0, saved_values["last_values"].get("fiz",""))
create_row("14. Fiz", entrada_fiz, 13)

# Link
ctk.CTkLabel(main_frame, text="Link do Formulário").grid(row=14, column=0, sticky="e", padx=(0,10), pady=4)
form_url_entry = ctk.CTkEntry(main_frame, width=400,
    fg_color="#D0E7FF", text_color="black")
default_url = "https://forms.office.com/Pages/ResponsePage.aspx?id=phHE5xOQZ0mlsT0I-e3BPm4ZyCW04uxHi5LaP7rueIFURFdHNDFISEZVSUc4MFc4TEJOWVpJSTRWOSQlQCN0PWcu"
form_url_entry.insert(0, saved_values["last_values"].get("form_url", default_url))
form_url_entry.grid(row=14, column=1, sticky="w", pady=4)

# Habilita/desabilita botões conforme licença
def disable_form(disable):
    state = "disabled" if disable else "normal"
    btn_send.configure(state=state)
    btn_send10.configure(state=state)

# Envio único
def enviar_formulario(date_override=None):
    if not is_license_valid():
        safe_log("⚠️ Chave inválida ou expirada. Valide a chave para enviar.\n")
        return
    # Coletar valores
    classif = combo_classificacao.get()
    empresa = combo_empresa.get()
    unidade = combo_unidade.get()
    data_form = date_override if date_override else entrada_data.get()
    hora = combo_hora.get()
    turno = combo_turno.get()
    area = combo_area.get()
    setor = combo_setor.get()
    atividade = combo_atividade.get()
    interv = combo_intervencao.get()
    cs = entrada_cs.get()
    obs = combo_observacao.get()
    desc = entrada_descricao.get()
    fiz = entrada_fiz.get()
    form_url = form_url_entry.get()

    # Validação CS
    if not cs.isdigit() or not (10 <= int(cs) <= 999999999):
        safe_log("⚠️ O campo CS deve conter um número entre 10 e 999999999.\n")
        return

    # Persistir últimas escolhas
    saved_values["last_values"] = {
        "classificacao": classif,"empresa":empresa,"unidade":unidade,
        "data":data_form,"hora":hora,"turno":turno,"area":area,"setor":setor,
        "atividade":atividade,"intervencao":interv,"cs":cs,"observacao":obs,
        "descricao":desc,"fiz":fiz,"form_url":form_url
    }

    # Atualizar listas e contadores
    if setor and setor not in saved_values["setor"]:
        saved_values["setor"].append(setor)
    if atividade and atividade not in saved_values["atividade"]:
        saved_values["atividade"].append(atividade)
    if interv:
        saved_values["intervencao_counts"][interv] = saved_values["intervencao_counts"].get(interv, 0) + 1
        update_intervencao_count_display(interv)
        if interv not in saved_values["intervencao"]:
            saved_values["intervencao"].append(interv)
        saved_values["intervencao_cs_map"][interv] = cs
    if obs:
        saved_values["observacao"] = [obs]
    save_values(saved_values)

    # Atualizar comboboxes
    combo_setor["values"] = saved_values["setor"]
    combo_atividade["values"] = saved_values["atividade"]
    combo_intervencao["values"] = saved_values["intervencao"]

    safe_log(f"▶ Enviando formulário (data={data_form})...\n")

    def worker():
        try:
            p = sync_playwright().start()
            browser = p.chromium.launch(headless=False)
            page = browser.new_page()
            page.goto(form_url)
            page.wait_for_selector("xpath=//*[@id='question-list']/div[1]//div[@role='button']")

            # Preenchimento
            page.locator("xpath=//*[@id='question-list']/div[1]//div[@role='button']").first.click()
            opts = page.locator("span[aria-label]")
            for i in range(opts.count()):
                if opts.nth(i).get_attribute("aria-label") == classif:
                    opts.nth(i).click(); break

            page.locator("xpath=//*[@id='question-list']/div[2]//div[@role='button']").first.click()
            opts = page.locator("span[aria-label]")
            for i in range(opts.count()):
                if opts.nth(i).get_attribute("aria-label") == empresa:
                    opts.nth(i).click(); break

            page.locator("xpath=//*[@id='question-list']/div[3]//div[@role='button']").first.click()
            opts = page.locator("span[aria-label]")
            for i in range(opts.count()):
                if opts.nth(i).get_attribute("aria-label") == unidade:
                    opts.nth(i).click(); break

            page.locator("xpath=//*[@id='question-list']/div[4]//input").fill(data_form)

            page.locator("xpath=//*[@id='question-list']/div[5]//div[@role='button']").click()
            opts = page.locator("span[aria-label]")
            for i in range(opts.count()):
                if opts.nth(i).get_attribute("aria-label") == hora:
                    opts.nth(i).click(); break

            page.locator("xpath=//*[@id='question-list']/div[6]//div[@role='button']").click()
            opts = page.locator("span[aria-label]")
            for i in range(opts.count()):
                if opts.nth(i).get_attribute("aria-label") == turno:
                    opts.nth(i).click(); break

            page.locator("xpath=//*[@id='question-list']/div[7]//div[@role='button']").click()
            opts = page.locator("span[aria-label]")
            for i in range(opts.count()):
                if opts.nth(i).get_attribute("aria-label") == area:
                    opts.nth(i).click(); break

            page.locator("xpath=//*[@id='question-list']/div[8]//input").fill(setor)
            page.locator("xpath=//*[@id='question-list']/div[9]//input").fill(atividade)
            page.locator("xpath=//*[@id='question-list']/div[10]//input").fill(interv)
            page.locator("xpath=//*[@id='question-list']/div[11]//input").fill(cs)

            page.locator("xpath=//*[@id='question-list']/div[12]//div[@role='button']").click()
            opts = page.locator("span[aria-label]")
            for i in range(opts.count()):
                if opts.nth(i).get_attribute("aria-label") == obs:
                    opts.nth(i).click(); break

            page.locator("xpath=//*[@id='question-list']/div[13]//textarea | //*[@id='question-list']/div[13]//input").fill(desc)
            page.locator("xpath=//*[@id='question-list']/div[14]//textarea | //*[@id='question-list']/div[14]//input").fill(fiz)

            page.locator("button:has-text('Enviar')").click()
            page.locator("text=Enviar outra resposta").click()
            safe_log(f"✅ Enviado (data={data_form})\n")
        except Exception as e:
            safe_log(f"⚠️ Erro ao enviar: {e}\n")
    threading.Thread(target=worker).start()

# Envio múltiplo
def enviar_dez_vezes():
    if not is_license_valid():
        safe_log("⚠️ Chave inválida ou expirada. Valide a chave para usar o envio 10x.\n")
        return
    def batch():
        try:
            form_url = form_url_entry.get()
            p = sync_playwright().start()
            browser = p.chromium.launch(headless=False)
            page = browser.new_page()
            page.goto(form_url)
            page.wait_for_selector("xpath=//*[@id='question-list']/div[1]//div[@role='button']")

            classif = combo_classificacao.get()
            empresa = combo_empresa.get()
            unidade = combo_unidade.get()
            hora = combo_hora.get()
            turno = combo_turno.get()
            area = combo_area.get()
            setor = combo_setor.get()
            atividade = combo_atividade.get()
            interv = combo_intervencao.get()
            cs = entrada_cs.get()
            obs = combo_observacao.get()
            desc = entrada_descricao.get()
            fiz = entrada_fiz.get()

            for i in range(10):
                date_val = (datetime.now() - timedelta(days=i)).strftime("%d/%m/%Y")
                # Atualizar contadores e listas
                if setor and setor not in saved_values["setor"]:
                    saved_values["setor"].append(setor)
                if atividade and atividade not in saved_values["atividade"]:
                    saved_values["atividade"].append(atividade)
                if interv:
                    saved_values["intervencao_counts"][interv] = saved_values["intervencao_counts"].get(interv,0) + 1
                    update_intervencao_count_display(interv)
                    if interv not in saved_values["intervencao"]:
                        saved_values["intervencao"].append(interv)
                    saved_values["intervencao_cs_map"][interv] = cs
                saved_values["observacao"] = [obs]
                saved_values["last_values"]["form_url"] = form_url
                save_values(saved_values)

                safe_log(f"▶ Enviando ({i+1}/10) com data {date_val}\n")

                # Repreencher campos
                page.locator("xpath=//*[@id='question-list']/div[1]//div[@role='button']").first.click()
                opts = page.locator("span[aria-label]")
                for j in range(opts.count()):
                    if opts.nth(j).get_attribute("aria-label") == classif:
                        opts.nth(j).click(); break

                page.locator("xpath=//*[@id='question-list']/div[2]//div[@role='button']").first.click()
                opts = page.locator("span[aria-label]")
                for j in range(opts.count()):
                    if opts.nth(j).get_attribute("aria-label") == empresa:
                        opts.nth(j).click(); break

                page.locator("xpath=//*[@id='question-list']/div[3]//div[@role='button']").first.click()
                opts = page.locator("span[aria-label]")
                for j in range(opts.count()):
                    if opts.nth(j).get_attribute("aria-label") == unidade:
                        opts.nth(j).click(); break

                page.locator("xpath=//*[@id='question-list']/div[4]//input").fill(date_val)

                page.locator("xpath=//*[@id='question-list']/div[5]//div[@role='button']").click()
                opts = page.locator("span[aria-label]")
                for j in range(opts.count()):
                    if opts.nth(j).get_attribute("aria-label") == hora:
                        opts.nth(j).click(); break

                page.locator("xpath=//*[@id='question-list']/div[6]//div[@role='button']").click()
                opts = page.locator("span[aria-label]")
                for j in range(opts.count()):
                    if opts.nth(j).get_attribute("aria-label") == turno:
                        opts.nth(j).click(); break

                page.locator("xpath=//*[@id='question-list']/div[7]//div[@role='button']").click()
                opts = page.locator("span[aria-label]")
                for j in range(opts.count()):
                    if opts.nth(j).get_attribute("aria-label") == area:
                        opts.nth(j).click(); break

                page.locator("xpath=//*[@id='question-list']/div[8]//input").fill(setor)
                page.locator("xpath=//*[@id='question-list']/div[9]//input").fill(atividade)
                page.locator("xpath=//*[@id='question-list']/div[10]//input").fill(interv)
                page.locator("xpath=//*[@id='question-list']/div[11]//input").fill(cs)
                page.locator("xpath=//*[@id='question-list']/div[12]//div[@role='button']").click()
                opts = page.locator("span[aria-label]")
                for j in range(opts.count()):
                    if opts.nth(j).get_attribute("aria-label") == obs:
                        opts.nth(j).click(); break
                page.locator("xpath=//*[@id='question-list']/div[13]//textarea | //*[@id='question-list']/div[13]//input").fill(desc)
                page.locator("xpath=//*[@id='question-list']/div[14]//textarea | //*[@id='question-list']/div[14]//input").fill(fiz)

                page.locator("button:has-text('Enviar')").click()
                page.locator("text=Enviar outra resposta").click()
                page.wait_for_selector("xpath=//*[@id='question-list']/div[1]//div[@role='button']")
                safe_log(f"✅ Enviado (data={date_val})\n")
            safe_log("✅ 10 envios concluídos em uma aba\n")
        except Exception as e:
            safe_log(f"⚠️ Erro no envio 10x: {e}\n")
    threading.Thread(target=batch).start()

# -----------------------------------------------------------------
# Botões de envio
frame_buttons = ctk.CTkFrame(janela); frame_buttons.pack(pady=20)
btn_send = ctk.CTkButton(frame_buttons, text="Preencher e Enviar",
                          command=lambda: enviar_formulario(),
                          fg_color="#800080", hover_color="#9932CC")
btn_send.pack(side="left", padx=(0,10))
btn_send10 = ctk.CTkButton(frame_buttons, text="10x",
                            command=lambda: enviar_dez_vezes(),
                            fg_color="#800080", hover_color="#9932CC")
btn_send10.pack(side="left")

# Controla disponibilidade inicial
def disable_form(disable):
    state = "disabled" if disable else "normal"
    btn_send.configure(state=state)
    btn_send10.configure(state=state)

disable_form(not is_license_valid())

# Área de log
log_box = ctk.CTkTextbox(janela, width=850, height=250)
log_box.pack(pady=20)

# Atualiza mensagem de licença
if is_license_valid():
    expiry_dt = datetime.fromisoformat(saved_values["license_expiry"])
    license_msg.configure(text=f"Chave válida! Expira em {expiry_dt.date()}", text_color="#00CC00")
else:
    license_msg.configure(text="Chave necessária para usar a ferramenta", text_color="#FF5555")

janela.mainloop()
