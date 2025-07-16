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
        // Removidos: nomeAcessoInput, emailAcessoInput
        acessarBtn: document.getElementById('acessar-chat-cliente-btn'), // Botão de acesso

        chatArea: document.getElementById('chat-area-cliente'),
        protocoloDisplay: document.getElementById('protocolo-cliente'),
        nomeDisplay: document.getElementById('nome-display-cliente'),
        chatMessages: document.getElementById('chat-messages-cliente'),
        mensagemInput: document.getElementById('mensagem-input-cliente'),
        enviarBtn: document.getElementById('enviar-btn-cliente')
    },

    // Prestador (sem alterações)
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

// Variáveis globais (sem alterações)
let socket;
let currentProtocol = null;
let userType = null;
let userName = null;

// Funções compartilhadas (sem alterações)
function setupSocket() {
    socket = io();

    socket.on('nova_mensagem', (data) => {
        if (currentProtocol === data.protocolo || userType === 'cliente') {
            addMessage(data.remetente, data.texto, data.data);
        } else if (userType === 'prestador') {
            console.log(`Nova mensagem para o protocolo ${data.protocolo} (chat não ativo)`);
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
            alert(`Novo chat aberto! Cliente: ${data.cliente}, Protocolo: ${data.id}`);
        });
    }

    socket.on('disconnect', () => {
        console.log('Desconectado do SocketIO');
    });
}

function addMessage(sender, text, time) {
    const area = userType === 'cliente'
        ? elements.cliente.chatMessages
        : elements.prestador.chatMessages;

    const messageDiv = document.createElement('div');
    const messageClass = (sender === 'cliente') ? 'client-message' : 'attendant-message';
    messageDiv.className = `message ${messageClass}`;
    messageDiv.innerHTML = `
        <span class="message-sender">${sender}</span>
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

    if (text && currentProtocol && socket) {
        socket.emit('enviar_mensagem', {
            protocolo: currentProtocol,
            remetente: userType,
            texto: text
        });
        input.value = '';
    }
}

function loadChatHistory(protocolo, clienteNomeFromBackend, clienteEmailFromBackend) {
    if (userType === 'cliente' && clienteNomeFromBackend) {
        userName = clienteNomeFromBackend;
    }

    fetch(`/buscar_chat/${protocolo}`)
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
                addMessage(msg.remetente, msg.texto, msg.data); // ✅ Correto agora
            });

            elements.cliente.formInicio.style.display = 'none';
            elements.cliente.formAcesso.style.display = 'none';
            elements.cliente.chatArea.style.display = 'block';

            if (!socket.connected) {
                setupSocket();
            } else {
                socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: false });
            }
        }
        else if (userType === 'prestador') {
            elements.prestador.nomeDisplay.textContent = data.nome;
            elements.prestador.protocoloDisplay.textContent = protocolo;
            elements.prestador.chatMessages.innerHTML = '';
            data.mensagens.forEach(msg => {
                addMessage(msg.remetente, msg.texto, msg.data); // ✅ Correto aqui também
            });

            elements.prestador.formAcesso.style.display = 'none';
            elements.prestador.chatArea.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('Erro ao carregar histórico do chat:', error);
        alert('Erro ao carregar histórico: ' + error.message);
        if (userType === 'prestador' && elements.prestador.formAcesso) {
            elements.prestador.chatArea.style.display = 'none';
            elements.prestador.formAcesso.style.display = 'block';
        }
    });
}

// Lógica do Cliente
document.addEventListener('DOMContentLoaded', () => {
    if (elements.cliente.formInicio) {
        userType = 'cliente';
        setupSocket(); // Inicializa o socket

        // Listener para Iniciar Novo Chat (sem alterações)
        elements.cliente.iniciarBtn.addEventListener('click', () => {
            userName = elements.cliente.nomeInput.value.trim();
            const userEmail = elements.cliente.emailInput.value.trim();

            if (!userName || !userEmail) {
                alert('Por favor, preencha seu nome e email para iniciar um novo chat.');
                return;
            }

            fetch('/iniciar_chat', {
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
                    elements.cliente.formInicio.style.display = 'none';
                    elements.cliente.formAcesso.style.display = 'none'; // Esconde o form de acesso também
                    elements.cliente.chatArea.style.display = 'block';

                    socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: false });
                    loadChatHistory(currentProtocol, data.nome, data.email); // Passa nome e email retornados
                } else {
                    alert('Erro ao iniciar chat: ' + (data.message || 'Erro desconhecido'));
                }
            })
            .catch(error => {
                console.error('Erro ao iniciar chat:', error);
                alert('Erro ao conectar com o servidor para iniciar o chat.');
            });
        });

        // Listener para Acessar Chat Existente por Protocolo (MODIFICADA)
        elements.cliente.acessarBtn.addEventListener('click', () => {
            const protocoloAcesso = elements.cliente.protocoloAcessoInput.value.trim();

            if (!protocoloAcesso) {
                alert('Por favor, digite o protocolo do chat para acessá-lo.');
                return;
            }

            currentProtocol = protocoloAcesso; // Define o protocolo atual para o socket

            // Usa o endpoint /buscar_chat que já existe para buscar por protocolo
            loadChatHistory(currentProtocol)
            .then(() => {
                // userName já será definido dentro de loadChatHistory com o nome do cliente do chat
                // Formulários já são escondidos dentro de loadChatHistory
            })
            .catch(error => {
                console.error('Erro ao acessar chat existente:', error);
                alert('Erro ao acessar chat: ' + error.message);
                // Permite que os formulários apareçam novamente em caso de erro
                elements.cliente.formInicio.style.display = 'block';
                elements.cliente.formAcesso.style.display = 'block';
                elements.cliente.chatArea.style.display = 'none';
            });
        });

        // Event listeners for sending messages (sem alterações)
        elements.cliente.enviarBtn.addEventListener('click', sendMessage);
        elements.cliente.mensagemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Lógica do Prestador (sem alterações)
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
                elements.prestador.formAcesso.style.display = 'none';
                elements.prestador.chatArea.style.display = 'block';
            })
            .catch(error => {
                console.error("Erro ao carregar chat ou acessar sala:", error);
            });
        });

        elements.prestador.enviarBtn.addEventListener('click', sendMessage);
        elements.prestador.mensagemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});