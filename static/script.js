// A URL do seu serviço de backend Flask no Render
// IMPORTANTE: Se o seu backend Flask está em um domínio diferente do seu frontend,
// você PRECISARÁ DEFINIR esta variável. Se eles estão no MESMO domínio (e o frontend
// está sendo servido pelo Render junto com o Flask, ou via proxy), você pode deixar
// io() e fetch() sem o BACKEND_URL, confiando no host atual.
// Vamos assumir que, para o ajuste, você quer a flexibilidade.
const BACKEND_URL = 'https://webchat-8xbq.onrender.com'; // MANTIDO PARA COMPATIBILIDADE SE NECESSÁRIO

// Elementos do DOM (mantidos como no seu código "atual", com os ajustes que você já fez)
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

    // Prestador (sem alterações - do seu código "atual")
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

// Variáveis globais (mantidas como no seu código "atual")
let socket;
let currentProtocol = null;
let userType = null;
let userName = null;

// Funções compartilhadas
function setupSocket() {
    // Usar BACKEND_URL para io() para garantir a conexão explícita ao backend Render
    socket = io(BACKEND_URL);

    socket.on('nova_mensagem', (data) => {
        // Lógica mais robusta para prestador, como no seu código "antigo"
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
            // Garante que o prestador entre na sala do dashboard para novas notificações
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
            // Mensagem de alerta para o prestador (pode ser melhorado com notificação sonora)
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

// FUNÇÃO addMessage AJUSTADA PARA O FORMATO ANTIGO
function addMessage(sender, text, time) {
    const area = userType === 'cliente'
        ? elements.cliente.chatMessages
        : elements.prestador.chatMessages;

    const messageDiv = document.createElement('div');

    // Lógica para displaySender RESTAURADA
    const displaySender = (sender === 'cliente' && userType === 'cliente') ? 'Você' :
                          (sender === 'prestador' && userType === 'prestador') ? 'Você' :
                          sender;

    // Lógica para messageClass RESTAURADA
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

    // Verificação robusta para envio de mensagem, como no código "antigo"
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

// FUNÇÃO loadChatHistory AJUSTADA PARA USAR BACKEND_URL E COMPORTAMENTO ANTIGO
function loadChatHistory(protocolo, clienteNomeFromBackend = null, clienteEmailFromBackend = null) {
    if (userType === 'cliente' && clienteNomeFromBackend) {
        userName = clienteNomeFromBackend;
    }

    // Usar BACKEND_URL para fetch
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

            // Lógica para setupSocket e emit 'entrar_sala' como no código "antigo"
            if (!socket || !socket.connected) {
                setupSocket();
            }
            if (socket.connected) {
                socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: false });
            } else {
                socket.on('connect', () => { // Espera a conexão se ainda não estiver conectado
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

            // Lógica para setupSocket e emit 'entrar_sala' como no código "antigo"
            if (!socket || !socket.connected) {
                setupSocket();
            }
            if (socket.connected) {
                socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: true });
            } else {
                socket.on('connect', () => { // Espera a conexão se ainda não estiver conectado
                    socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: true });
                });
            }
        }
    })
    .catch(error => {
        console.error('Erro ao carregar histórico do chat:', error);
        alert('Erro ao carregar histórico: ' + error.message);
        // Garante que os formulários corretos são exibidos em caso de erro
        if (userType === 'prestador' && elements.prestador.formAcesso) {
            elements.prestador.chatArea.style.display = 'none';
            elements.prestador.formAcesso.style.display = 'block';
        } else if (userType === 'cliente') {
            elements.cliente.formInicio.style.display = 'block';
            elements.cliente.formAcesso.style.display = 'block';
            elements.cliente.chatArea.style.display = 'none';
        }
        throw error; // Propaga o erro para o chamador
    });
}

// Lógica do Cliente
document.addEventListener('DOMContentLoaded', () => {
    if (elements.cliente.formInicio) {
        userType = 'cliente';
        // Removi a chamada setupSocket() daqui para ser chamada apenas quando necessário
        // (ao iniciar um novo chat ou acessar um existente) para evitar múltiplos sockets

        elements.cliente.iniciarBtn.addEventListener('click', () => {
            userName = elements.cliente.nomeInput.value.trim();
            const userEmail = elements.cliente.emailInput.value.trim();

            if (!userName || !userEmail) {
                alert('Por favor, preencha seu nome e email para iniciar um novo chat.');
                return;
            }
            
            // Usar BACKEND_URL para fetch
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
                    // setupSocket() agora é chamado dentro de loadChatHistory se o socket não estiver conectado
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

            // setupSocket() agora é chamado dentro de loadChatHistory se o socket não estiver conectado
            loadChatHistory(currentProtocol)
            .then(() => {
                //userName já será definido dentro de loadChatHistory com o nome do cliente do chat
                //Formulários já são escondidos dentro de loadChatHistory
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
        setupSocket(); // Inicializa o socket para o prestador assim que a página carrega

        elements.prestador.acessarBtn.addEventListener('click', () => {
            currentProtocol = elements.prestador.protocoloInput.value.trim();

            if (!currentProtocol) {
                alert('Por favor, digite o protocolo do chat.');
                return;
            }

            // O socket já deve estar conectado neste ponto, apenas emite a entrada na sala
            // socket.emit('entrar_sala', { protocolo: currentProtocol, is_atendente: true });
            // A chamada acima foi movida para dentro de loadChatHistory para garantir a ordem

            loadChatHistory(currentProtocol)
            .then(() => {
                // Display handled by loadChatHistory
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
