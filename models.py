from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pytz  # ⬅️ Adicionado

db = SQLAlchemy()

def hora_brasilia():
    return datetime.now(pytz.timezone("America/Sao_Paulo"))

class Chat(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    cliente_nome = db.Column(db.String(100), nullable=False)
    cliente_email = db.Column(db.String(100), nullable=False)
    data_inicio = db.Column(db.DateTime(timezone=True), default=hora_brasilia)  # ✅ corrigido
    status = db.Column(db.String(20), default='aberto')

    mensagens = db.relationship('Mensagem', backref='chat', lazy=True, order_by='Mensagem.data_hora')


class Mensagem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    chat_id = db.Column(db.String(36), db.ForeignKey('chat.id'), nullable=False)
    remetente = db.Column(db.String(50), nullable=False)
    texto = db.Column(db.Text, nullable=False)
    data_hora = db.Column(db.DateTime(timezone=True), default=hora_brasilia)  # ✅ corrigido
