const BACKEND_URL = window.location.origin; // Usa a URL base do seu app Render
let socket;
let currentProtocol = null;
let userName = '';
let userType = ''; // 'cliente' ou 'prestador'

// Mapeamento de elementos do DOM para facilitar o acesso
const elements = {
    cliente: {
        formInicio: document.getElementById('form-inicio-chat'),
        nomeInput: document.getElementById('nome-cliente'),
        emailInput: document.getElementById('email-cliente'),
        iniciarBtn: document.getElementById('iniciar-chat-btn'),
        formAcesso: document.getElementById('form-acesso-chat-cliente'),
        protocoloInput: document.getElementById('protocolo-cliente'),
        acessarBtn: document.getElementById('acessar-chat-cliente-btn'),
        chatArea: document.getElementById('chat-area-cliente')
    },
    prestador: {
        formAcesso: document.getElementById('form-acesso-chat-prestador'),
        protocoloInput: document.getElementById('protocolo-prestador'),
        acessarBtn: document.getElementById('acessar-chat-prestador-btn'),
        chatArea: document.getElementById('chat-area-prestador'),
        dashboardLink: document.getElementById('dashboard-link')
    },
    comum: {
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        chatMessages: document.getElementById('chat-messages'),
        chatHeader: document.getElementById('chat-header-protocolo'),
        chatInfo: document.getElementById('chat-header-info'),
        leaveChatBtn: document.getElementById('leave-chat-btn')
    },
    dashboard: {
        container: document.getElementById('dashboard-container'),
        chatList: document.getElementById('chat-list')
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
            if (userType === 'prestador' && elements.dashboard.container) {
                // Atendente sempre entra na sala de dashboard ao conectar
                socket.emit('entrar_sala', { protocolo: 'atendente_dashboard', is_atendente: true });
                updateChatList(); // Atualiza a lista de chats no dashboard
            } else if (currentProtocol) {
                // Se for cliente e já tiver protocolo, tenta entrar na sala do chat
                socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: false });
            }
        });

        socket.on('disconnect', () => {
            console.log('Desconectado do servidor Socket.IO.');
            // Se o usuário está em um chat, talvez mostre uma mensagem de reconexão
            if (currentProtocol && userType !== 'prestador_dashboard') {
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
                displayMessage(data.remetente, data.texto, data.remetente === userName ? 'self' : 'other', data.data);
            }
        });

        socket.on('chat_status_atualizado', (data) => {
            if (userType === 'prestador' && elements.dashboard.container) {
                // Atualiza a lista de chats no dashboard
                updateChatList();
            }
            if (data.protocolo === currentProtocol && userType !== 'prestador_dashboard') {
                // Para o cliente ou prestador dentro de um chat específico, pode mostrar uma notificação
                displayMessage('Sistema', `Status do chat atualizado para: ${data.status}`, 'system');
            }
        });

        socket.on('novo_chat_aberto', (data) => {
            if (userType === 'prestador' && elements.dashboard.container) {
                // Adiciona o novo chat à lista do dashboard
                const newChatItem = document.createElement('li');
                newChatItem.id = `chat-${data.id}`;
                newChatItem.innerHTML = `
                    <p>Protocolo: <strong>${data.id}</strong></p>
                    <p>Cliente: ${data.cliente}</p>
                    <p>Email: ${data.email}</p>
                    <p>Status: <span id="status-${data.id}">${data.status}</span></p>
                    <button data-protocolo="${data.id}" class="acessar-chat-btn">Acessar</button>
                `;
                elements.dashboard.chatList.prepend(newChatItem); // Adiciona no topo
                addDashboardButtonListeners(); // Re-adiciona listeners para o novo botão
            }
        });
    }
}

/**
 * Adiciona uma mensagem ao DOM do chat.
 * @param {string} sender Nome do remetente.
 * @param {string} text Conteúdo da mensagem.
 * @param {string} type Tipo da mensagem ('self', 'other', 'system').
 * @param {string} timestamp Hora da mensagem (HH:MM).
 */
function displayMessage(sender, text, type, timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type); // Adiciona classe para estilização (e.g., 'self', 'other', 'system')
    messageElement.innerHTML = `
        <span class="sender">${sender}:</span>
        <span class="text">${text}</span>
        <span class="timestamp">${timestamp}</span>
    `;
    elements.comum.chatMessages.appendChild(messageElement);
    elements.comum.chatMessages.scrollTop = elements.comum.chatMessages.scrollHeight; // Rola para o final
}

/**
 * Carrega o histórico de mensagens de um chat específico.
 * @param {string} protocolo O protocolo do chat.
 * @param {string} clienteNome O nome do cliente do chat.
 * @param {string} clienteEmail O email do cliente do chat.
 * @returns {Promise<void>} Uma promessa que resolve quando o histórico é carregado.
 */
function loadChatHistory(protocolo, clienteNome = null, clienteEmail = null) {
    elements.comum.chatMessages.innerHTML = ''; // Limpa mensagens anteriores
    elements.comum.chatHeader.textContent = `Protocolo: ${protocolo}`;

    if (clienteNome && clienteEmail) {
        elements.comum.chatInfo.textContent = `Cliente: ${clienteNome} | Email: ${clienteEmail}`;
    } else {
        elements.comum.chatInfo.textContent = ''; // Limpa se não tiver info
    }

    // Garante que o socket está configurado antes de emitir 'entrar_sala'
    setupSocket(); // Chama para garantir que o socket está ativo e os listeners configurados
    socket.emit('entrar_sala', { protocolo: protocolo, is_atendente: userType === 'prestador' });

    // Tentar buscar o chat novamente para popular nome/email no cabeçalho
    return fetch(`${BACKEND_URL}/buscar_chat/${protocolo}`)
        .then(response => {
            if (!response.ok) { // Verifica se a resposta HTTP foi um erro (ex: 404, 500)
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
                elements.comum.chatHeader.textContent = `Protocolo: ${data.protocolo}`;
                elements.comum.chatInfo.textContent = `Cliente: ${data.nome} | Email: ${data.email}`;
                data.mensagens.forEach(msg => {
                    displayMessage(msg.remetente, msg.texto, msg.remetente === userName ? 'self' : 'other', msg.data);
                });
                elements.comum.chatArea.style.display = 'block';

                if (userType === 'cliente') {
                    elements.cliente.formInicio.style.display = 'none';
                    elements.cliente.formAcesso.style.display = 'none';
                } else if (userType === 'prestador') {
                    elements.prestador.formAcesso.style.display = 'none';
                    if (elements.dashboard.container) {
                         elements.dashboard.container.style.display = 'none';
                    }
                }
            } else {
                alert('Erro ao carregar histórico do chat: ' + (data.message || 'Erro desconhecido.'));
                // Retorna à tela inicial ou de acesso em caso de erro no histórico
                if (userType === 'prestador') {
                    elements.prestador.chatArea.style.display = 'none';
                    if (elements.dashboard.container) elements.dashboard.container.style.display = 'block';
                    elements.prestador.formAcesso.style.display = 'block';
                } else {
                    elements.cliente.chatArea.style.display = 'none';
                    elements.cliente.formAcesso.style.display = 'block';
                    elements.cliente.formInicio.style.display = 'block';
                }
            }
        })
        .catch(error => {
            console.error('Falha ao carregar histórico do chat:', error);
            alert('Não foi possível carregar o histórico do chat: ' + error.message);
            // Garante que os formulários corretos são exibidos em caso de erro
            if (userType === 'prestador') {
                elements.prestador.chatArea.style.display = 'none';
                if (elements.dashboard.container) elements.dashboard.container.style.display = 'block'; // Voltar ao dashboard
                elements.prestador.formAcesso.style.display = 'block';
            } else {
                elements.cliente.chatArea.style.display = 'none';
                elements.cliente.formAcesso.style.display = 'block';
                elements.cliente.formInicio.style.display = 'block';
            }
        });
}

/**
 * Atualiza a lista de chats abertos no dashboard do prestador.
 */
function updateChatList() {
    if (!elements.dashboard.container) return; // Só executa se estiver no dashboard

    fetch(`${BACKEND_URL}/chats_abertos`)
        .then(response => {
            if (!response.ok) {
                return response.json().catch(() => {
                    throw new Error(`Erro do servidor (${response.status}) ao buscar chats abertos.`);
                }).then(errorData => {
                    throw new Error(errorData.message || `Erro do servidor (${response.status}) ao buscar chats abertos.`);
                });
            }
            return response.json();
        })
        .then(chats => {
            elements.dashboard.chatList.innerHTML = ''; // Limpa a lista atual
            if (chats.length === 0) {
                const noChats = document.createElement('li');
                noChats.textContent = 'Nenhum chat aberto no momento.';
                elements.dashboard.chatList.appendChild(noChats);
                return;
            }
            chats.forEach(chat => {
                const chatItem = document.createElement('li');
                chatItem.id = `chat-${chat.id}`;
                chatItem.innerHTML = `
                    <p>Protocolo: <strong>${chat.id}</strong></p>
                    <p>Cliente: ${chat.nome_cliente}</p>
                    <p>Email: ${chat.email_cliente}</p>
                    <p>Status: <span id="status-${chat.id}">${chat.status}</span></p>
                    <button data-protocolo="${chat.id}" class="acessar-chat-btn">Acessar</button>
                `;
                elements.dashboard.chatList.appendChild(chatItem);
            });
            addDashboardButtonListeners(); // Adiciona listeners aos novos botões de acesso
        })
        .catch(error => {
            console.error('Erro ao carregar lista de chats:', error);
            alert('Não foi possível carregar a lista de chats: ' + error.message);
            elements.dashboard.chatList.innerHTML = '<li>Erro ao carregar chats.</li>';
        });
}

/**
 * Adiciona listeners de clique aos botões "Acessar" do dashboard.
 */
function addDashboardButtonListeners() {
    document.querySelectorAll('.acessar-chat-btn').forEach(button => {
        button.onclick = null; // Remove handlers antigos para evitar duplicação
        button.addEventListener('click', (event) => {
            const protocolo = event.target.dataset.protocolo;
            currentProtocol = protocolo;
            // Para o atendente, o userName é o protocolo para identificação na mensagem
            userName = `Atendente (${protocolo})`;
            loadChatHistory(protocolo); // Carrega o histórico para o chat selecionado
        });
    });
}

/**
 * Event Listeners e Lógica Principal
 */
document.addEventListener('DOMContentLoaded', () => {
    // Detecta se é a página do cliente ou prestador
    if (elements.cliente.formInicio) { // Se o formulário de início de chat do cliente existe
        userType = 'cliente';
        setupSocket(); // Inicializa o socket para o cliente

        // Lógica do Cliente - Iniciar Chat
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
                if (!response.ok) { // Verifica se a resposta HTTP foi um erro (ex: 404, 500)
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
                // Pode reexibir o formulário ou fazer algo mais aqui
            });
        });

        // Lógica do Cliente - Acessar Chat Existente
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

    } else if (elements.prestador.formAcesso) { // Se o formulário de acesso do prestador existe
        userType = 'prestador';
        setupSocket(); // Inicializa o socket para o prestador

        // Lógica do Prestador - Acessar Chat Específico
        elements.prestador.acessarBtn.addEventListener('click', () => {
            const protocolo = elements.prestador.protocoloInput.value.trim();
            if (!protocolo) {
                alert('Por favor, insira um protocolo para acessar o chat.');
                return;
            }
            currentProtocol = protocolo;
            userName = `Atendente (${protocolo})`; // Identificação do atendente
            loadChatHistory(protocolo); // Carrega o histórico do chat
        });

        // Lógica do Prestador - Dashboard (se estiver na página do dashboard)
        if (elements.dashboard.container) {
            userType = 'prestador_dashboard'; // Subtipo para lidar com o dashboard
            elements.dashboard.container.style.display = 'block'; // Mostra o dashboard

            // Entra na sala do dashboard automaticamente ao carregar a página
            if (socket.connected) {
                socket.emit('entrar_sala', { protocolo: 'atendente_dashboard', is_atendente: true });
                updateChatList();
            } else {
                socket.on('connect', () => { // Espera a conexão se ainda não estiver pronto
                    socket.emit('entrar_sala', { protocolo: 'atendente_dashboard', is_atendente: true });
                    updateChatList();
                });
            }

            // Exemplo: Atualizar lista de chats a cada X segundos (opcional)
            // setInterval(updateChatList, 30000); // A cada 30 segundos
        }
    }

    // Lógica Comum - Enviar Mensagem (visível em ambos os tipos de usuário no chat)
    if (elements.comum.sendButton) {
        elements.comum.sendButton.addEventListener('click', () => {
            const messageText = elements.comum.messageInput.value.trim();
            if (messageText && currentProtocol && socket) {
                socket.emit('enviar_mensagem', {
                    protocolo: currentProtocol,
                    remetente: userName,
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

    // Lógica Comum - Sair do Chat
    if (elements.comum.leaveChatBtn) {
        elements.comum.leaveChatBtn.addEventListener('click', () => {
            if (currentProtocol && socket) {
                socket.emit('sair_sala', { protocolo: currentProtocol }); // Se você tiver um evento 'sair_sala' no backend
                socket.disconnect(); // Desconecta o socket
                socket = null; // Limpa a referência para que seja recriado na próxima vez

                currentProtocol = null; // Limpa o protocolo atual

                // Volta para a tela inicial ou dashboard dependendo do tipo de usuário
                if (userType === 'cliente') {
                    elements.cliente.chatArea.style.display = 'none';
                    elements.cliente.formInicio.style.display = 'block';
                    elements.cliente.formAcesso.style.display = 'block';
                } else if (userType === 'prestador') {
                    elements.prestador.chatArea.style.display = 'none';
                    if (elements.dashboard.container) {
                        elements.dashboard.container.style.display = 'block';
                        updateChatList(); // Atualiza a lista de chats
                    } else {
                        elements.prestador.formAcesso.style.display = 'block';
                    }
                }
                elements.comum.chatMessages.innerHTML = ''; // Limpa as mensagens
                elements.comum.chatHeader.textContent = '';
                elements.comum.chatInfo.textContent = '';
                alert('Você saiu do chat.');
                // Recarrega a página para garantir um estado limpo
                window.location.reload();
            }
        });
    }
});
