AUTOMATIZADOR WEB (Flask + Playwright) — PRONTO PARA RENDER (Docker)

1) Suba esta pasta para um repositório no GitHub.
2) No Render, clique em: New > Blueprint, aponte para este repo (usa render.yaml).
   OU New > Web Service > Docker, aponte para este repo.
3) O serviço criará um disco persistente em /data (saved_fields.json).
4) Acesse a URL pública e valide sua licença (TheMito = 30d, TheMito10 = 90d).
5) Preencha os campos e clique em “Preencher e Enviar” ou “10x”.

Observações:
- Esta versão usa a imagem oficial do Playwright no Docker, garantindo Chromium headless.
- Se desejar restaurar dados/limpar o estado, apague /data/saved_fields.json