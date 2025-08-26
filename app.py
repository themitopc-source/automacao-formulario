from flask import Flask, render_template, request

app = Flask(__name__)

@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        nome = request.form.get('nome')
        email = request.form.get('email')
        return f"<h2>Formulário recebido!</h2><p>Nome: {nome}</p><p>Email: {email}</p>"
    return render_template('index.html')
