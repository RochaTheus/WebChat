from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from models import db, Chat, Mensagem
from flask_cors import CORS # ✅ Importe a extensão Flask-CORS
from datetime import datetime
import pytz
import os # ✅ Importe o módulo os para variáveis de ambiente

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'sua_chave_secreta_aqui'

# ✅ Configuração do CORS para o objeto 'app'
# Esta linha é crucial para as requisições HTTP regulares (como iniciar_chat, buscar_chat, etc.)
# Substitua 'https://webchat-8xbq.onrender.com' pela URL REAL do seu frontend no Render.
# Se houver mais de uma URL de frontend, use uma lista:
# CORS(app, resources={r"/*": {"origins": ["https://webchat-8xbq.onrender.com", "https://outra-url-frontend.onrender.com"]}})
CORS(app, resources={r"/*": {"origins": "https://webchat-8xbq.onrender.com"}})


# ✅ Flask-SocketIO com configuração de CORS
# 'cors_allowed_origins' deve ser o mesmo que você configurou acima para o CORS geral.
socketio = SocketIO(app, cors_allowed_origins="https://webchat-8xbq.onrender.com")

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
        'data': new_chat.data_inicio.astimezone(pytz.timezone("America/Sao_Paulo")).strftime('%Y-%m-%d %H:%M:%S')
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
        'data': msg.data_hora.astimezone(pytz.timezone("America/Sao_Paulo")).strftime('%H:%M:%S')
    } for msg in chat.mensagens]

    return jsonify({
        'protocolo': chat.id,
        'nome': chat.cliente_nome,
        'email': chat.cliente_email,
        'mensagens': mensagens_data
    })

@app.route('/chats_abertos', methods=['GET'])
def get_chats_abertos():
    try:
        chats_abertos = Chat.query.filter_by(status='aberto').order_by(Chat.data_inicio.asc()).all()

        chats_data = []
        for chat in chats_abertos:
            ultima_mensagem = None
            if chat.mensagens:
                mensagens_ordenadas = sorted(chat.mensagens, key=lambda msg: msg.data_hora, reverse=True)
                if mensagens_ordenadas:
                    ultima_mensagem = {
                        'remetente': mensagens_ordenadas[0].remetente,
                        'texto': mensagens_ordenadas[0].texto,
                        'data_hora': mensagens_ordenadas[0].data_hora.astimezone(pytz.timezone("America/Sao_Paulo")).strftime('%H:%M:%S')
                    }

            chats_data.append({
                'id': chat.id,
                'cliente_nome': chat.cliente_nome,
                'cliente_email': chat.cliente_email,
                'data_inicio': chat.data_inicio.astimezone(pytz.timezone("America/Sao_Paulo")).strftime('%Y-%m-%d %H:%M:%S'),
                'status': chat.status,
                'ultima_mensagem': ultima_mensagem
            })
        
        return jsonify({'status': 'success', 'chats': chats_data}), 200

    except Exception as e:
        print(f"Erro ao buscar chats abertos: {e}")
        return jsonify({'status': 'error', 'message': 'Erro ao buscar chats abertos.'}), 500

@socketio.on('entrar_sala')
def handle_entrar_sala(data):
    protocolo = data.get('protocolo')
    is_atendente = data.get('is_atendente', False)

    # ✅ DEBUG: Adicionado print para verificar o evento de entrada na sala
    print(f"DEBUG: Evento 'entrar_sala' recebido. Protocolo: {protocolo}, Atendente: {is_atendente}")

    if not protocolo:
        emit('sala_entrada', {'status': 'error', 'message': 'Protocolo ausente.'})
        print("DEBUG: Protocolo ausente para 'entrar_sala'.") # ✅ DEBUG
        return

    chat = Chat.query.get(protocolo)
    if not chat and protocolo != 'atendente_dashboard': # 'atendente_dashboard' é uma sala especial, não um chat
        emit('sala_entrada', {'status': 'error', 'message': 'Chat não encontrado
