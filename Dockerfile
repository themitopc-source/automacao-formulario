FROM mcr.microsoft.com/playwright/python:v1.46.0-jammy

WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Browsers já vêm instalados nessa imagem
COPY server.py /app/
COPY templates /app/templates
COPY static /app/static

ENV PYTHONUNBUFFERED=1

# Render fornece PORT; use-a ao iniciar
CMD gunicorn server:app -b 0.0.0.0:${PORT:-8000} --workers 1 --threads 4 --timeout 180
