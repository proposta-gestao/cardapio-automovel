/**
 * ♠️♦️ACP Pedidos — Painel do Atendente (Realtime)
 */

const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Firebase Push Notifications ---
const firebaseConfig = {
    apiKey: "AIzaSyAftUTevxn9QT7TwUAyWRVRvXCBR5-6QKU",
    authDomain: "alerta-cardapio-automovel.firebaseapp.com",
    projectId: "alerta-cardapio-automovel",
    storageBucket: "alerta-cardapio-automovel.firebasestorage.app",
    messagingSenderId: "74575424285",
    appId: "1:74575424285:web:c16d1c8433480761cf4ff4",
    measurementId: "G-4YTG9TPF1D"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
const VAPID_KEY = "BB7rXxrEnQS80-3vZTi8Qdxnb2NxbFammqrhUNV7PSkd4ziIOAof8xeu4bvZnTKkwM6J0AZmBxtR8lO1MC8b058";

// --- Estado ---
let orders = [];
let waiter = null;
let realtimeChannel = null;
const bell = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// --- Utils ---
function formatCurrency(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCpf(v) {
    v = v.replace(/\D/g, "");
    if (v.length > 3) v = v.slice(0, 3) + "." + v.slice(3);
    if (v.length > 7) v = v.slice(0, 7) + "." + v.slice(7);
    if (v.length > 11) v = v.slice(0, 11) + "-" + v.slice(11, 13);
    return v;
}

// --- Auth ---
async function login() {
    const cpf = document.getElementById('loginCpf').value.replace(/\D/g, '');
    const senha = document.getElementById('loginSenha').value;
    const errorMsg = document.getElementById('errorMsg');

    if (cpf.length !== 11 || !senha) {
        errorMsg.innerText = "Informe um CPF válido e a senha.";
        errorMsg.style.display = 'block';
        return;
    }

    const { data, error } = await sb
        .from('atendentes')
        .select('*')
        .eq('cpf', cpf)
        .eq('senha', senha)
        .single();

    if (error || !data) {
        errorMsg.innerText = "CPF ou Senha incorretos.";
        errorMsg.style.display = 'block';
        return;
    }

    waiter = data;
    localStorage.setItem('acp_waiter', JSON.stringify(data));
    showAudioOverlay();
}

function checkSession() {
    const saved = localStorage.getItem('acp_waiter');
    if (saved) {
        waiter = JSON.parse(saved);
        startDashboard(); // Entra direto se já estiver logado
    }
}

function showAudioOverlay() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('audioOverlay').style.display = 'flex';
}

function startDashboard() {
    document.getElementById('loginScreen').style.display = 'none'; // Esconde o login
    document.getElementById('audioOverlay').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'block';
    document.getElementById('waiterName').innerText = waiter.nome;
    
    // Inicia processos
    loadOrders();
    setupRealtime();
    setupPushNotifications();
    
    // Tenta tocar o som para verificar se o navegador bloqueou
    bell.play()
        .then(() => {
            console.log("Áudio liberado!");
            document.getElementById('soundAlertBar').style.display = 'none';
        })
        .catch(() => {
            console.log("Áudio bloqueado pelo navegador. Mostrando barra de ativação.");
            document.getElementById('soundAlertBar').style.display = 'block';
        });
}

function unlockAudio() {
    bell.play().then(() => {
        document.getElementById('soundAlertBar').style.display = 'none';
        console.log("Sons ativados com sucesso!");
    }).catch(e => console.error("Falha ao ativar som:", e));
}

function logout() {
    localStorage.removeItem('acp_waiter');
    window.location.reload();
}

// --- Notificações Push ---
async function setupPushNotifications() {
    try {
        if (!('serviceWorker' in navigator)) {
            console.warn("Service Worker não suportado neste navegador.");
            return;
        }
        
        console.log("Solicitando permissão para notificações...");
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log("Permissão concedida! Obtendo token FCM...");
            
            // Garantir que o service worker está registrado antes de pedir o token
            const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
            console.log("Service Worker registrado para Push:", registration.scope);

            const token = await messaging.getToken({ 
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration 
            });

            if (token) {
                console.log("FCM Token gerado com sucesso.");
                await registerToken(token);
            } else {
                console.warn("Nenhum token FCM recebido.");
            }
        } else {
            console.warn("Permissão de notificação negada pelo usuário.");
        }
    } catch (err) {
        console.error("Erro crítico ao configurar push notifications:", err);
    }
}

async function registerToken(token) {
    if (!waiter || !waiter.id) {
        console.error("Impossível registrar token: Atendente não está logado ou ID é inválido.");
        return;
    }
    
    console.log(`Registrando token no Supabase para o atendente: ${waiter.nome} (${waiter.id})`);
    
    // Salva o token no Supabase usando upsert (evita duplicidade pelo push_token)
    const { error } = await sb.from('atendente_tokens').upsert({
        atendente_id: waiter.id,
        push_token: token,
        updated_at: new Date().toISOString()
    }, { onConflict: 'push_token' });

    if (error) {
        console.error("❌ Erro ao salvar token no banco de dados:", error.message);
    } else {
        console.log("✅ Token registrado no Supabase com sucesso!");
    }
}

// --- Gestão de Abas (Mobile) ---
function switchTab(tabName) {
    // Atualiza botões
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Atualiza colunas
    document.querySelectorAll('.board-column').forEach(col => {
        col.classList.remove('active');
    });

    if (tabName === 'pendente') document.getElementById('colPendente').classList.add('active');
    if (tabName === 'cozinha') document.getElementById('colCozinha').classList.add('active');
}

// --- Dados ---
async function loadOrders() {
    // Busca pedidos das últimas 12 horas que não estão 'finalizados' ou 'cancelados'
    const dozeHorasAtras = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
        .from('orders')
        .select(`
            *,
            order_items (*)
        `)
        .gte('created_at', dozeHorasAtras)
        .not('status', 'in', '("concluido","cancelado")')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao carregar pedidos:", error);
        return;
    }

    orders = data || [];
    renderBoard();
}

function setupRealtime() {
    if (realtimeChannel) sb.removeChannel(realtimeChannel);

    console.log("Iniciando conexão Realtime...");

    realtimeChannel = sb.channel('orders-realtime')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'orders' 
        }, payload => {
            console.log("Evento INSERT recebido!", payload);
            handleNewOrder(payload);
        })
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'orders' 
        }, payload => {
            console.log("Evento UPDATE recebido!", payload);
            handleUpdatedOrder(payload);
        })
        .subscribe((status) => {
            console.log("Status da conexão Realtime:", status);
            if (status === 'SUBSCRIBED') {
                console.log("Conectado com sucesso ao fluxo de pedidos!");
            }
        });
}

async function handleNewOrder(payload) {
    console.log("Novo pedido recebido!", payload.new);
    
    // Para pegar os itens, precisamos buscar novamente (ou o payload teria que ser mais complexo)
    const { data, error } = await sb
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', payload.new.id)
        .single();

    if (!error && data) {
        orders.unshift(data);
        bell.play();
        renderBoard();
    }
}

function handleUpdatedOrder(payload) {
    const idx = orders.findIndex(o => o.id === payload.new.id);
    if (idx !== -1) {
        // Se mudou para um status que não mostramos mais, removemos da lista
        if (['concluido', 'cancelado'].includes(payload.new.status)) {
            orders.splice(idx, 1);
        } else {
            // Atualiza o objeto mantendo os itens que já tínhamos
            orders[idx] = { ...orders[idx], ...payload.new };
        }
        renderBoard();
    }
}

async function updateOrderStatus(orderId, newStatus) {
    const { error } = await sb
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

    if (error) {
        alert("Erro ao atualizar status: " + error.message);
    }
}

async function assumirPedido(orderId) {
    if (!waiter) return;

    const { error } = await sb
        .from('orders')
        .update({ 
            atendente_id: waiter.id,
            atendente_nome: waiter.nome
        })
        .eq('id', orderId);

    if (error) {
        alert("Erro ao assumir pedido: " + error.message);
    } else {
        abrirModalDetalhes(orderId);
    }
}

// --- Funções do Modal de Detalhes ---
function abrirModalDetalhes(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('modalConfirmacao');
    const info = document.getElementById('modalOrderInfo');
    const itemsList = document.getElementById('modalOrderItems');
    const btnCozinha = document.getElementById('btnModalEnviarCozinha');

    info.innerText = `Pedido #${order.id.slice(0, 8)} | ${order.customer_name}`;

    let itemsHtml = (order.order_items || []).map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
            <span>${item.quantity}x ${item.product_name}</span>
            <span style="color:var(--accent-waiter); font-weight:700;">${formatCurrency(item.unit_price * item.quantity)}</span>
        </div>
        ${item.observations ? `<div style="font-size:0.8rem; color:#FF7F50; margin-top:-5px; margin-bottom:10px;">Obs: ${item.observations}</div>` : ''}
    `).join('');

    itemsList.innerHTML = `
        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:15px;">
            ${itemsHtml}
            <div style="border-top:1px solid #333; margin-top:10px; padding-top:10px; display:flex; justify-content:space-between; font-weight:700;">
                <span>Total</span>
                <span>${formatCurrency(order.total)}</span>
            </div>
        </div>
    `;

    btnCozinha.onclick = async () => {
        exibirConfirmacao(
            "Confirmar Envio?", 
            "Você confirma que o pagamento foi recebido e o pedido deve ir para a cozinha agora?",
            async () => {
                btnCozinha.disabled = true;
                btnCozinha.innerText = "ENVIANDO...";
                
                // Fluxo: Marca como pago internamente e envia pra cozinha
                await updateOrderStatus(orderId, 'cozinha');
                fecharModalConfirmacao();
                fecharAviso();
                
                setTimeout(() => {
                    btnCozinha.disabled = false;
                    btnCozinha.innerText = "CONFIRMAR PAGAMENTO E ENVIAR 🍳";
                }, 500);
            }
        );
    };

    modal.style.display = 'flex';
}

function fecharModalConfirmacao() {
    document.getElementById('modalConfirmacao').style.display = 'none';
}

// --- Funções do Popup de Aviso Customizado ---
function exibirConfirmacao(titulo, texto, callback, icone = '💰') {
    const modal = document.getElementById('modalAviso');
    document.getElementById('avisoTitle').innerText = titulo;
    document.getElementById('avisoText').innerText = texto;
    document.querySelector('.modal-aviso-icon').innerText = icone;
    
    const btnConfirm = document.getElementById('btnAvisoConfirm');
    
    // Usamos um clone para limpar event listeners anteriores
    const newBtn = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);
    
    newBtn.onclick = callback;
    modal.style.display = 'flex';
}

function fecharAviso() {
    document.getElementById('modalAviso').style.display = 'none';
}

function confirmarFinalizacao(orderId) {
    exibirConfirmacao(
        "Finalizar Pedido?",
        "O pedido já está pronto para ser entregue? Isso removerá o card da tela da cozinha.",
        async () => {
            await updateOrderStatus(orderId, 'concluido');
            fecharAviso();
        },
        "🏁"
    );
}

// --- Renderização ---
function renderBoard() {
    const listPendente = document.getElementById('listPendente');
    const listCozinha = document.getElementById('listCozinha');

    listPendente.innerHTML = '';
    listCozinha.innerHTML = '';

    let cPendente = 0, cCozinha = 0;

    orders.forEach(order => {
        const card = createOrderCard(order);
        if (order.status === 'pendente') {
            listPendente.appendChild(card);
            cPendente++;
        } else if (order.status === 'cozinha') {
            listCozinha.appendChild(card);
            cCozinha++;
        }
    });

    document.getElementById('countPendente').innerText = cPendente;
    document.getElementById('countCozinha').innerText = cCozinha;

    // Atualiza badges das abas mobile
    document.getElementById('badgeTabPendente').innerText = cPendente;
    document.getElementById('badgeTabCozinha').innerText = cCozinha;
}

function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = `order-card card-${order.status}`;
    div.dataset.orderId = order.id;

    const timeStr = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const localizacao = order.customer_address;

    let actionButton = '';
    let waiterInfoView = '';

    if (order.status === 'pendente') {
        if (!order.atendente_id) {
            actionButton = `
                <div class="card-actions">
                    <button class="btn-action btn-assume" onclick="assumirPedido('${order.id}')">ASSUMIR 🤝</button>
                    <button class="btn-action btn-cancel" onclick="updateOrderStatus('${order.id}', 'cancelado')">CANCELAR</button>
                </div>
            `;
        } else {
            waiterInfoView = `<div class="order-waiter">👤 Atendendo: ${order.atendente_nome}</div>`;
            actionButton = `
                <div class="card-actions">
                    <button class="btn-action btn-view" onclick="abrirModalDetalhes('${order.id}')">VER DETALHES 📋</button>
                </div>
            `;
        }
    } else if (order.status === 'cozinha') {
        actionButton = `
            <div class="card-actions">
                <button class="btn-action btn-done" onclick="confirmarFinalizacao('${order.id}')">Finalizar Pedido ✅</button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="card-header" onclick="abrirModalDetalhes('${order.id}')" style="cursor:pointer; align-items: flex-start;">
            <span class="order-id">#${order.id.slice(0, 8)}</span>
            <div style="text-align: right;">
                <span class="order-time">${timeStr}</span>
                ${order.atendente_nome ? `<div style="font-size: 0.7rem; color: var(--status-pago); font-weight: 700; margin-top: 2px; text-transform: uppercase;">${order.atendente_nome}</div>` : ''}
            </div>
        </div>
        <div style="cursor:pointer" onclick="abrirModalDetalhes('${order.id}')">
            <p class="customer-name">${order.customer_name}</p>
            <div class="order-location" style="margin-top:5px; margin-bottom:5px;">MESA ${localizacao.mesa || '??'} | POS ${localizacao.posicao || '??'}</div>
            <div class="card-footer" style="margin-top:10px;">
                <span style="color:#888; font-size: 0.8rem">Total</span>
                <span class="order-total" style="font-size:1rem;">${formatCurrency(order.total)}</span>
            </div>
        </div>
        ${actionButton}
    `;

    return div;
}

// --- Eventos ---
document.getElementById('btnLogin').onclick = login;
document.getElementById('btnLogout').onclick = logout;
document.getElementById('btnAudioEnable').onclick = startDashboard;

document.getElementById('loginCpf').oninput = (e) => {
    e.target.value = formatCpf(e.target.value);
};

// Iniciar
checkSession();

// Desbloqueia áudio no primeiro clique em qualquer lugar da página para facilitar
document.body.addEventListener('click', () => {
    if (document.getElementById('soundAlertBar').style.display === 'block') {
        unlockAudio();
    }
}, { once: true });
