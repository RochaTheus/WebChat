// A URL do seu serviço de backend Flask no Render
// IMPORTANTE: SUBSTITUA 'https://SUA-URL-DO-BACKEND.onrender.com' PELA URL REAL DO SEU BACKEND FLASK NO RENDER!
// Exemplo: 'https://meu-chat-backend.onrender.com'
const BACKEND_URL = 'https://SUA-URL-DO-BACKEND.onrender.com'; 

// Elementos do DOM
const elements = {
    // Cliente
    cliente: {
        formInicio: document.getElementById('form-inicio-cliente'),
        nomeInput: document.getElementById('nome-cliente'), // Para iniciar novo chat
        emailInput: document.getElementById('email-cliente'), // Para iniciar novo chat
        iniciarBtn: document.getElementById('iniciar-chat-btn'),

        formAcesso: document.getElementById('form-acesso-cliente'), // Formulário de acesso
        protocoloAcessoInput: document.getElementById('protocolo-acesso-cliente'), // Input de protocolo
        acessarBtn: document.getElementById('acessar-chat-cliente-btn'), // Botão de acesso

        chatArea: document.getElementById('chat-area-cliente'),
        protocoloDisplay: document.getElementById('protocolo-cliente'),
        nomeDisplay: document.getElementById('nome-display-cliente'),
        chatMessages: document.getElementById('chat-messages-cliente'),
        mensagemInput: document.getElementById('mensagem-input-cliente'),
        enviarBtn: document.getElementById('enviar-btn-cliente')
    },

    // Prestador
    prestador: {
        formAcesso: document.getElementById('form-acesso-prestador'),
        protocoloInput: document.getElementById('protocolo-input'),
        acessarBtn: document.getElementById('acessar-chat-btn'),
        chatArea: document.getElementById('chat-area-prestador'),
        protocoloDisplay: document.getElementById('protocolo-prestador'),
        nomeDisplay: document.getElementById('nome-display-prestador'),
        chatMessages: document.getElementById('chat-messages-prestador'),
        mensagemInput: document.getElementById('mensagem-input-prestador'),
        enviarBtn: document.getElementById('enviar-btn-prestador')
    }
};

// Variáveis globais
let socket;
let currentProtocol = null;
let userType = null;
let userName = null;

// Funções compartilhadas
function setupSocket() {
    socket = io(BACKEND_URL); 

    socket.on('nova_mensagem', (data) => {
        if (userType === 'prestador') {
            if (currentProtocol && currentProtocol === data.protocolo) {
                addMessage(data.remetente, data.texto, data.data);
            } else {
                 console.log(`Nova mensagem para o protocolo ${data.protocolo} (chat não ativo para o prestador)`);
            }
        } else if (userType === 'cliente' && currentProtocol === data.protocolo) {
            addMessage(data.remetente, data.texto, data.data);
        }
    });

    socket.on('connect', () => {
        console.log(`Conectado ao SocketIO como ${userType}.`);
        if (currentProtocol) {
            socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: (userType === 'prestador') });
        }
        if (userType === 'prestador') {
            socket.emit('entrar_sala', { protocolo: 'atendente_dashboard', is_atendente: true });
        }
    });

    socket.on('sala_entrada', (data) => {
        console.log('Status da sala:', data);
        if (data.status === 'error') {
            alert('Erro ao entrar na sala: ' + data.message);
        }
    });

    if (userType === 'prestador') {
        socket.on('novo_chat_aberto', (data) => {
            console.log('Novo chat aberto recebido:', data);
            // Melhorar notificação do prestador
            // Você pode adicionar um som se tiver um arquivo 'notification.mp3' em sua pasta /static
            // const notificationSound = new Audio('/static/notification.mp3'); 
            // notificationSound.play();
            alert(`Novo chat aberto! Cliente: ${data.cliente}, Protocolo: ${data.id}. Por favor, acesse o painel de chats abertos para atender.`);
        });
    }

    socket.on('disconnect', () => {
        console.log('Desconectado do SocketIO');
    });

    socket.on('connect_error', (err) => {
        console.error('Erro de conexão do SocketIO:', err);
        alert('Erro ao conectar ao servidor de chat. Por favor, tente recarregar a página. Detalhes: ' + err.message);
    });
}

function addMessage(sender, text, time) {
    const area = userType === 'cliente'
        ? elements.cliente.chatMessages
        : elements.prestador.chatMessages;

    const messageDiv = document.createElement('div');
    const displaySender = (sender === 'cliente' && userType === 'cliente') ? 'Você' :
                          (sender === 'prestador' && userType === 'prestador') ? 'Você' :
                          sender;

    const messageClass = (sender === userType) ? 'self-message' : 'other-message';
    
    messageDiv.className = `message ${messageClass}`;
    messageDiv.innerHTML = `
        <span class="message-sender">${displaySender}</span>
        <span class="message-time">${time}</span>
        <div class="message-text">${text}</div>
    `;

    area.appendChild(messageDiv);
    area.scrollTop = area.scrollHeight;
}


function sendMessage() {
    const input = userType === 'cliente'
        ? elements.cliente.mensagemInput
        : elements.prestador.mensagemInput;

    const text = input.value.trim();

    if (text && currentProtocol && socket && socket.connected) { 
        socket.emit('enviar_mensagem', {
            protocolo: currentProtocol,
            remetente: userType, 
            texto: text
        });
        input.value = '';
    } else {
        console.warn('Não foi possível enviar a mensagem. Texto vazio, protocolo ausente ou socket desconectado.');
        if (!socket || !socket.connected) {
            alert('Você não está conectado ao chat. Por favor, tente novamente ou recarregue a página.');
        }
    }
}

function loadChatHistory(protocolo, clienteNomeFromBackend = null, clienteEmailFromBackend = null) {
    if (userType === 'cliente' && clienteNomeFromBackend) {
        userName = clienteNomeFromBackend; 
    }

    return fetch(`${BACKEND_URL}/buscar_chat/${protocolo}`)
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.message || 'Erro desconhecido ao buscar chat.');
            });
        }
        return response.json();
    })
    .then(data => {
        if (userType === 'cliente') {
            elements.cliente.nomeDisplay.textContent = data.nome;
            elements.cliente.protocoloDisplay.textContent = protocolo;
            elements.cliente.chatMessages.innerHTML = '';
            data.mensagens.forEach(msg => {
                addMessage(msg.remetente, msg.texto, msg.data);
            });

            elements.cliente.formInicio.style.display = 'none';
            elements.cliente.formAcesso.style.display = 'none';
            elements.cliente.chatArea.style.display = 'block';

            if (!socket || !socket.connected) { 
                 setupSocket(); 
            }
            if (socket.connected) {
                socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: false });
            } else {
                socket.on('connect', () => {
                    socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: false });
                });
            }
        }
        else if (userType === 'prestador') {
            elements.prestador.nomeDisplay.textContent = data.nome;
            elements.prestador.protocoloDisplay.textContent = protocolo;
            elements.prestador.chatMessages.innerHTML = '';
            data.mensagens.forEach(msg => {
                addMessage(msg.remetente, msg.texto, msg.data);
            });

            elements.prestador.formAcesso.style.display = 'none';
            elements.prestador.chatArea.style.display = 'block';

            if (!socket || !socket.connected) { 
                 setupSocket(); 
            }
            if (socket.connected) {
                socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: true });
            } else {
                socket.on('connect', () => {
                    socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: true });
                });
            }
        }
    })
    .catch(error => {
        console.error('Erro ao carregar histórico do chat:', error);
        alert('Erro ao carregar histórico: ' + error.message);
        if (userType === 'prestador' && elements.prestador.formAcesso) {
            elements.prestador.chatArea.style.display = 'none';
            elements.prestador.formAcesso.style.display = 'block';
        } else if (userType === 'cliente') { 
            elements.cliente.formInicio.style.display = 'block';
            elements.cliente.formAcesso.style.display = 'block';
            elements.cliente.chatArea.style.display = 'none';
        }
        throw error; 
    });
}

// Lógica do Cliente
document.addEventListener('DOMContentLoaded', () => {
    if (elements.cliente.formInicio) {
        userType = 'cliente';

        elements.cliente.iniciarBtn.addEventListener('click', () => {
            userName = elements.cliente.nomeInput.value.trim();
            const userEmail = elements.cliente.emailInput.value.trim();

            if (!userName || !userEmail) {
                alert('Por favor, preencha seu nome e email para iniciar um novo chat.');
                return;
            }
            
            fetch(`${BACKEND_URL}/iniciar_chat`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: userName,
                    email: userEmail
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'chat_iniciado') {
                    currentProtocol = data.protocolo;
                    setupSocket(); 
                    loadChatHistory(currentProtocol, data.nome, data.email);
                } else {
                    alert('Erro ao iniciar chat: ' + (data.message || 'Erro desconhecido'));
                }
            })
            .catch(error => {
                console.error('Erro ao iniciar chat:', error);
                alert('Erro ao conectar com o servidor para iniciar o chat.');
            });
        });

        elements.cliente.acessarBtn.addEventListener('click', () => {
            const protocoloAcesso = elements.cliente.protocoloAcessoInput.value.trim();

            if (!protocoloAcesso) {
                alert('Por favor, digite o protocolo do chat para acessá-lo.');
                return;
            }

            currentProtocol = protocoloAcesso;

            setupSocket();
            loadChatHistory(currentProtocol)
            .then(() => {
            })
            .catch(error => {
                console.error('Erro ao acessar chat existente:', error);
                alert('Erro ao acessar chat: ' + error.message);
                elements.cliente.formInicio.style.display = 'block';
                elements.cliente.formAcesso.style.display = 'block';
                elements.cliente.chatArea.style.display = 'none';
            });
        });

        elements.cliente.enviarBtn.addEventListener('click', sendMessage);
        elements.cliente.mensagemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Lógica do Prestador
    if (elements.prestador.formAcesso) {
        userType = 'prestador';
        userName = 'Atendente';
        setupSocket(); 

        elements.prestador.acessarBtn.addEventListener('click', () => {
            currentProtocol = elements.prestador.protocoloInput.value.trim();

            if (!currentProtocol) {
                alert('Por favor, digite o protocolo do chat.');
                return;
            }

            socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: true });

            loadChatHistory(currentProtocol)
            .then(() => {
            })
            .catch(error => {
                console.error("Erro ao carregar chat ou acessar sala:", error);
                elements.prestador.formAcesso.style.display = 'block';
                elements.prestador.chatArea.style.display = 'none';
            });
        });

        elements.prestador.enviarBtn.addEventListener('click', sendMessage);
        elements.prestador.mensagemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});
