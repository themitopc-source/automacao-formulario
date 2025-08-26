FROM mcr.microsoft.com/playwright/python:v1.46.0-jammy

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install -r requirements.txt

COPY . .

# Start with Gunicorn (Flask app)
CMD ["sh","-lc","gunicorn -w 2 -k gthread -b 0.0.0.0:${PORT:-10000} server:app"]
