# Coletor de Dados (Hospedado) — Para envio local depois

Este app hospeda uma página idêntica em espírito à do programa, mas **somente salva os dados** para envio posterior na sua máquina.

- Validação: só salva se *todos os campos* estiverem preenchidos corretamente.
- UX: mostra círculo **Enviando...** e depois **Enviado! (dados salvos)**.
- Armazenamento: SQLite em `STORE_DIR` (padrão `/data`), compatível com Docker/Render.
  - Plano Free: use `STORE_DIR=/tmp` (sem persistência); baixe os dados via export.
- Export: `/export.json` e `/export.csv` (use `ADMIN_TOKEN` para proteger: `?token=SEU_TOKEN`).

## Executar localmente
```bash
pip install -r requirements.txt
export STORE_DIR=./data
python server.py
# abre http://localhost:10000
```

## Deploy no Render
- **Dockerfile Path**: `./Dockerfile`
- **Health check**: `/health`
- **Env vars**:
  - `STORE_DIR=/tmp` (Free) ou disco montado em `/data` (planos pagos)
  - `ADMIN_TOKEN=<opcional>` para proteger export
```
