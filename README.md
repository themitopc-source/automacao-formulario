# Automatizador Web (Flask + Playwright) — pronto para Render (Docker)

## Passos
1) Suba esta pasta para um repositório no GitHub.
2) No Render, crie via **New → Blueprint** (apontando para este repo) ou **New → Web Service → Docker**.
3) Um disco persistente será montado em **/data** (para `saved_fields.json`).
4) Acesse a URL pública e valide sua licença (**THEMITO = 30d**, **THEMITO10 = 90d**).
5) Preencha os campos e clique em **“Preencher e Enviar”** ou **“10x”**.

### Observações
- A imagem base é a oficial do Playwright para **Python 3.12** (tag `v1.46.0-jammy`), com Chromium headless funcional.
- Para restaurar/limpar dados, apague `/data/saved_fields.json`.
- Porta padrão: `PORT` do Render (propagado para o Flask em `server.py`).

## Rodar localmente
```bash
pip install -r requirements.txt
python server.py
# Acesse http://localhost:8000
```
