from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from models import db, Chat, Mensagem
from datetime import datetime
import pytz  # ✅ Adicionado para ajuste de fuso

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat_app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'sua_chave_secreta_aqui'

db.init_app(app)
socketio = SocketIO(app)

with app.app_context():
    db.create_all()

@app.route('/')
def index_cliente():
    return render_template('cliente.html')

@app.route('/prestador')
def index_prestador():
    return render_template('prestador.html')

@app.route('/iniciar_chat', methods=['POST'])
def iniciar_chat():
    data = request.get_json()
    nome = data.get('nome')
    email = data.get('email')

    if not nome or not email:
        return jsonify({'status': 'error', 'message': 'Nome e email são obrigatórios'}), 400

    # ✅ Corrigido para hora de Brasília
    now = datetime.now(pytz.timezone("America/Sao_Paulo"))
    protocolo_gerado = now.strftime('%d%m%y%H%M%S')

    new_chat = Chat(id=protocolo_gerado, cliente_nome=nome, cliente_email=email)
    db.session.add(new_chat)
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': f'Erro ao criar chat, tente novamente. Detalhe: {str(e)}'}), 500

    socketio.emit('novo_chat_aberto', {
        'id': new_chat.id,
        'cliente': new_chat.cliente_nome,
        'data': new_chat.data_inicio.astimezone(pytz.timezone("America/Sao_Paulo")).strftime('%Y-%m-%d %H:%M:%S')  # ✅ Conversão da data
    }, room='atendente_dashboard')

    return jsonify({
        'status': 'chat_iniciado',
        'protocolo': new_chat.id,
        'nome': new_chat.cliente_nome,
        'email': new_chat.cliente_email
    })

@app.route('/buscar_chat/<protocolo>')
def buscar_chat(protocolo):
    chat = Chat.query.get(protocolo)
    if not chat:
        return jsonify({'status': 'error', 'message': 'Protocolo não encontrado.'}), 404

    mensagens_data = [{
        'remetente': msg.remetente,
        'texto': msg.texto,
        'data': msg.data_hora.astimezone(pytz.timezone("America/Sao_Paulo")).strftime('%H:%M:%S')  # ✅ Corrigido
    } for msg in chat.mensagens]

    return jsonify({
        'protocolo': chat.id,
        'nome': chat.cliente_nome,
        'email': chat.cliente_email,
        'mensagens': mensagens_data
    })

@socketio.on('entrar_sala')
def handle_entrar_sala(data):
    protocolo = data.get('protocolo')
    is_atendente = data.get('is_atendente', False)

    if not protocolo:
        emit('sala_entrada', {'status': 'error', 'message': 'Protocolo ausente.'})
        return

    chat = Chat.query.get(protocolo)
    if not chat and protocolo != 'atendente_dashboard':
        emit('sala_entrada', {'status': 'error', 'message': 'Chat não encontrado.'})
        return

    join_room(protocolo)
    print(f"[{request.sid}] {'Prestador' if is_atendente else 'Cliente'} entrou na sala: {protocolo}")
    emit('sala_entrada', {'status': 'success', 'protocolo': protocolo}, room=request.sid)

@socketio.on('enviar_mensagem')
def handle_enviar_mensagem(data):
    protocolo = data.get('protocolo')
    remetente = data.get('remetente')
    texto = data.get('texto')

    if not protocolo or not remetente or not texto:
        return

    chat = Chat.query.get(protocolo)
    if not chat:
        return

    new_message = Mensagem(chat_id=protocolo, remetente=remetente, texto=texto)
    db.session.add(new_message)
    db.session.commit()

    # ✅ Ajuste para mostrar horário corretamente
    data_formatada = new_message.data_hora.astimezone(pytz.timezone("America/Sao_Paulo")).strftime('%H:%M:%S')

    emit('nova_mensagem', {
        'protocolo': protocolo,
        'remetente': remetente,
        'texto': texto,
        'data': data_formatada
    }, room=protocolo)
    print(f"Mensagem no protocolo {protocolo} de {remetente}: {texto}")

if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
