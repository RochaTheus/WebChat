const BACKEND_URL = window.location.origin; // Usa a URL base do seu app Render
let socket;
let currentProtocol = null;
let userName = '';
let userType = ''; // 'cliente' ou 'prestador' (embora aqui seja sempre 'cliente' para este HTML)

// Mapeamento de elementos do DOM para facilitar o acesso
// AJUSTADO PARA OS IDS DO SEU HTML DE CLIENTE
const elements = {
    cliente: {
        formInicio: document.getElementById('form-inicio-cliente'), // AJUSTADO
        nomeInput: document.getElementById('nome-cliente'),
        emailInput: document.getElementById('email-cliente'),
        iniciarBtn: document.getElementById('iniciar-chat-btn'),
        formAcesso: document.getElementById('form-acesso-cliente'), // AJUSTADO
        protocoloInput: document.getElementById('protocolo-acesso-cliente'), // AJUSTADO
        acessarBtn: document.getElementById('acessar-chat-cliente-btn'),
        chatArea: document.getElementById('chat-area-cliente'),
        protocoloDisplay: document.getElementById('protocolo-cliente'), // ID para exibir o protocolo no chat-area
        nomeDisplay: document.getElementById('nome-display-cliente') // ID para exibir o nome no chat-area
    },
    // Removendo o objeto 'prestador' pois este HTML é apenas para o cliente
    // Removendo o objeto 'dashboard' pois este HTML é apenas para o cliente
    comum: {
        messageInput: document.getElementById('mensagem-input-cliente'), // AJUSTADO
        sendButton: document.getElementById('enviar-btn-cliente'), // AJUSTADO
        chatMessages: document.getElementById('chat-messages-cliente'), // AJUSTADO
        // Removendo chatHeader e chatInfo do objeto comum pois os IDs estão no objeto cliente
        leaveChatBtn: null // Não existe botão de sair neste HTML, então null
    }
};

/**
 * Inicializa a conexão Socket.IO, se ainda não estiver conectada.
 * Configura os listeners globais de Socket.IO.
 */
function setupSocket() {
    if (!socket || !socket.connected) {
        socket = io(BACKEND_URL);

        socket.on('connect', () => {
            console.log('Conectado ao servidor Socket.IO!');
            if (currentProtocol) {
                // Se for cliente e já tiver protocolo, tenta entrar na sala do chat
                socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: false });
            }
        });

        socket.on('disconnect', () => {
            console.log('Desconectado do servidor Socket.IO.');
            if (currentProtocol) {
                displayMessage('Sistema', 'Você foi desconectado. Tentando reconectar...', 'system');
            }
        });

        socket.on('connect_error', (error) => {
            console.error('Erro de conexão Socket.IO:', error);
            displayMessage('Sistema', 'Não foi possível conectar ao servidor de chat. Verifique sua conexão.', 'system');
        });

        socket.on('sala_entrada', (data) => {
            if (data.status === 'success') {
                console.log(data.message);
            } else {
                console.error('Erro ao entrar na sala:', data.message);
                alert('Erro ao entrar na sala: ' + data.message);
            }
        });

        socket.on('nova_mensagem', (data) => {
            if (data.protocolo === currentProtocol) {
                // Determine o tipo de mensagem com base no remetente para aplicar a classe CSS correta
                const messageType = data.remetente === userName ? 'client-message' : 'attendant-message';
                displayMessage(data.remetente, data.texto, messageType, data.data); // USANDO client-message/attendant-message
            }
        });

        socket.on('chat_status_atualizado', (data) => {
            if (data.protocolo === currentProtocol) {
                displayMessage('Sistema', `Status do chat atualizado para: ${data.status}`, 'system');
            }
        });

        // Removendo 'novo_chat_aberto' pois é relevante apenas para o dashboard do prestador
    }
}

/**
 * Adiciona uma mensagem ao DOM do chat.
 * @param {string} sender Nome do remetente.
 * @param {string} text Conteúdo da mensagem.
 * @param {string} type Tipo da mensagem ('client-message', 'attendant-message', 'system').
 * @param {string} timestamp Hora da mensagem (HH:MM).
 */
function displayMessage(sender, text, type, timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) {
    const messageElement = document.createElement('div');
    // Adiciona as classes 'message' (para estilo geral) e o 'type' específico (client-message, attendant-message, system)
    messageElement.classList.add('message', type);

    // Ajusta a estrutura interna para corresponder ao seu CSS:
    // <span class="message-sender">Remetente:</span> Texto da mensagem <span class="message-time">HH:MM</span>
    let senderHtml = '';
    if (type !== 'system') { // Mensagens do sistema não precisam de remetente visível assim
        senderHtml = `<span class="message-sender">${sender}:</span> `;
    }

    messageElement.innerHTML = `
        ${senderHtml}
        ${text}
        <span class="message-time">${timestamp}</span>
    `;
    elements.comum.chatMessages.appendChild(messageElement);
    elements.comum.chatMessages.scrollTop = elements.comum.chatMessages.scrollHeight; // Rola para o final
}

/**
 * Carrega o histórico de mensagens de um chat específico.
 * @param {string} protocolo O protocolo do chat.
 * @param {string} clienteNome O nome do cliente do chat (opcional, pode vir do backend).
 * @param {string} clienteEmail O email do cliente do chat (opcional, pode vir do backend).
 * @returns {Promise<void>} Uma promessa que resolve quando o histórico é carregado.
 */
function loadChatHistory(protocolo, clienteNome = null, clienteEmail = null) {
    elements.comum.chatMessages.innerHTML = ''; // Limpa mensagens anteriores
    
    // ATUALIZA OS ELEMENTOS DE DISPLAY NO HEADER DO CHAT
    if (elements.cliente.protocoloDisplay) {
        elements.cliente.protocoloDisplay.textContent = protocolo;
    }
    if (elements.cliente.nomeDisplay && clienteNome) {
        elements.cliente.nomeDisplay.textContent = clienteNome;
    } else {
        elements.cliente.nomeDisplay.textContent = 'Carregando...'; // Caso o nome ainda não tenha chegado
    }

    setupSocket(); // Chama para garantir que o socket está ativo e os listeners configurados
    socket.emit('entrar_sala', { protocolo: protocolo, is_atendente: false });

    return fetch(`${BACKEND_URL}/buscar_chat/${protocolo}`)
        .then(response => {
            if (!response.ok) {
                return response.json().catch(() => {
                    throw new Error(`Erro do servidor (${response.status}) ao buscar chat. Por favor, tente novamente.`);
                }).then(errorData => {
                    throw new Error(errorData.message || `Erro do servidor (${response.status}) ao buscar chat.`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                if (elements.cliente.protocoloDisplay) {
                    elements.cliente.protocoloDisplay.textContent = data.protocolo;
                }
                if (elements.cliente.nomeDisplay) {
                    elements.cliente.nomeDisplay.textContent = data.nome;
                }
                
                data.mensagens.forEach(msg => {
                    // Determine o tipo de mensagem com base no remetente para aplicar a classe CSS correta
                    const messageType = msg.remetente === userName ? 'client-message' : 'attendant-message';
                    displayMessage(msg.remetente, msg.texto, messageType, msg.data);
                });
                elements.cliente.chatArea.style.display = 'block';
                elements.cliente.formInicio.style.display = 'none';
                elements.cliente.formAcesso.style.display = 'none';
            } else {
                alert('Erro ao carregar histórico do chat: ' + (data.message || 'Erro desconhecido.'));
                elements.cliente.chatArea.style.display = 'none';
                elements.cliente.formAcesso.style.display = 'block';
                elements.cliente.formInicio.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Falha ao carregar histórico do chat:', error);
            alert('Não foi possível carregar o histórico do chat: ' + error.message);
            elements.cliente.chatArea.style.display = 'none';
            elements.cliente.formAcesso.style.display = 'block';
            elements.cliente.formInicio.style.display = 'block';
        });
}

// Removendo updateChatList e addDashboardButtonListeners pois são para o prestador/dashboard

/**
 * Event Listeners e Lógica Principal
 */
document.addEventListener('DOMContentLoaded', () => {
    userType = 'cliente'; // Sempre 'cliente' para este HTML
    setupSocket(); // Inicializa o socket para o cliente

    // Lógica do Cliente - Iniciar Chat
    if (elements.cliente.iniciarBtn) {
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
            .then(response => {
                if (!response.ok) {
                    return response.json().catch(() => {
                        throw new Error(`Erro do servidor (${response.status}) ao iniciar chat. Tente novamente.`);
                    }).then(errorData => {
                        throw new Error(errorData.message || `Erro do servidor (${response.status}) ao iniciar chat.`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'chat_iniciado') {
                    currentProtocol = data.protocolo;
                    loadChatHistory(currentProtocol, data.nome, data.email);
                } else {
                    alert('Erro lógico ao iniciar chat: ' + (data.message || 'Erro desconhecido do servidor.'));
                }
            })
            .catch(error => {
                console.error('Falha na comunicação:', error);
                alert('Não foi possível iniciar o chat: ' + error.message);
            });
        });
    }

    // Lógica do Cliente - Acessar Chat Existente
    if (elements.cliente.acessarBtn) {
        elements.cliente.acessarBtn.addEventListener('click', () => {
            const protocolo = elements.cliente.protocoloInput.value.trim();
            if (!protocolo) {
                alert('Por favor, insira um protocolo para acessar o chat.');
                return;
            }
            currentProtocol = protocolo;
            userName = "Cliente"; // Nome padrão para cliente ao acessar por protocolo
            loadChatHistory(protocolo); // Carrega o histórico do chat
        });
    }

    // Lógica Comum - Enviar Mensagem
    if (elements.comum.sendButton) {
        elements.comum.sendButton.addEventListener('click', () => {
            const messageText = elements.comum.messageInput.value.trim();
            if (messageText && currentProtocol && socket) {
                socket.emit('enviar_mensagem', {
                    protocolo: currentProtocol,
                    remetente: userName, // Este é o nome do cliente que está digitando
                    texto: messageText
                });
                elements.comum.messageInput.value = ''; // Limpa o input
            }
        });

        // Enviar mensagem ao pressionar Enter
        elements.comum.messageInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                elements.comum.sendButton.click();
            }
        });
    }

    // O botão de sair não existe neste HTML, então a lógica foi removida.
});
