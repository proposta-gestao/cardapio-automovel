/**
 * ♠️♦️ACP Pedidos — Painel do Atendente (Realtime)
 */

const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    if (tabName === 'pago') document.getElementById('colPago').classList.add('active');
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
    const btn = document.querySelector(`[data-order-id="${orderId}"] .btn-action`);
    if (btn) btn.disabled = true;

    const { error } = await sb
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

    if (error) {
        alert("Erro ao atualizar status: " + error.message);
        if (btn) btn.disabled = false;
    } else {
        // Se marcou como pago, abre o modal de confirmação para enviar p/ cozinha
        if (newStatus === 'pago') {
            abrirModalConfirmacao(orderId);
        }
    }
}

// --- Funções do Modal de Confirmação ---
function abrirModalConfirmacao(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('modalConfirmacao');
    const info = document.getElementById('modalOrderInfo');
    const itemsList = document.getElementById('modalOrderItems');
    const btnCozinha = document.getElementById('btnModalEnviarCozinha');

    info.innerText = `Pedido de ${order.customer_name} | Mesa ${order.customer_address.mesa || '??'}`;

    let itemsHtml = (order.order_items || []).map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
            <span>${item.quantity}x ${item.product_name}</span>
            <span style="color:var(--accent-waiter); font-weight:700;">${formatCurrency(item.unit_price * item.quantity)}</span>
        </div>
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
        // Desabilita o botão para evitar cliques duplos
        btnCozinha.disabled = true;
        btnCozinha.innerText = "ENVIANDO...";
        
        await updateOrderStatus(orderId, 'cozinha');
        fecharModalConfirmacao();
        
        // Pequeno delay para resetar o botão caso o modal seja reaberto depois
        setTimeout(() => {
            btnCozinha.disabled = false;
            btnCozinha.innerText = "ENVIAR PARA COZINHA 🍳";
        }, 500);
    };

    modal.style.display = 'flex';
}

function fecharModalConfirmacao() {
    document.getElementById('modalConfirmacao').style.display = 'none';
}

// --- Renderização ---
function renderBoard() {
    const listPendente = document.getElementById('listPendente');
    const listPago = document.getElementById('listPago');
    const listCozinha = document.getElementById('listCozinha');

    listPendente.innerHTML = '';
    listPago.innerHTML = '';
    listCozinha.innerHTML = '';

    let cPendente = 0, cPago = 0, cCozinha = 0;

    orders.forEach(order => {
        const card = createOrderCard(order);
        if (order.status === 'pendente') {
            listPendente.appendChild(card);
            cPendente++;
        } else if (order.status === 'pago') {
            listPago.appendChild(card);
            cPago++;
        } else if (order.status === 'cozinha') {
            listCozinha.appendChild(card);
            cCozinha++;
        }
    });

    document.getElementById('countPendente').innerText = cPendente;
    document.getElementById('countPago').innerText = cPago;
    document.getElementById('countCozinha').innerText = cCozinha;

    // Atualiza badges das abas mobile
    document.getElementById('badgeTabPendente').innerText = cPendente;
    document.getElementById('badgeTabPago').innerText = cPago;
    document.getElementById('badgeTabCozinha').innerText = cCozinha;
}

function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = `order-card card-${order.status}`;
    div.dataset.orderId = order.id;

    const timeStr = new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const localizacao = order.customer_address; // { mesa, posicao }

    let itemsHtml = (order.order_items || []).map(item => `
        <li>
            <span>${item.quantity}x ${item.product_name}</span>
            <span>${formatCurrency(item.unit_price * item.quantity)}</span>
        </li>
        ${item.observations ? `<span class="item-obs">Obs: ${item.observations}</span>` : ''}
    `).join('');

    let actionButton = '';
    if (order.status === 'pendente') {
        actionButton = `
            <div class="card-actions">
                <button class="btn-action btn-pay" onclick="updateOrderStatus('${order.id}', 'pago')">Marcar como Pago 💰</button>
                <button class="btn-action btn-cancel" onclick="updateOrderStatus('${order.id}', 'cancelado')">Cancelar</button>
            </div>
        `;
    } else if (order.status === 'pago') {
        actionButton = `
            <div class="card-actions">
                <button class="btn-action btn-kitchen" onclick="updateOrderStatus('${order.id}', 'cozinha')">Enviar p/ Cozinha 🍳</button>
            </div>
        `;
    } else if (order.status === 'cozinha') {
        actionButton = `
            <div class="card-actions">
                <button class="btn-action btn-done" onclick="updateOrderStatus('${order.id}', 'concluido')">Finalizar Pedido ✅</button>
            </div>
        `;
    }

    div.innerHTML = `
        <div class="card-header">
            <span class="order-id">#${order.id.slice(0, 8)}</span>
            <span class="order-time">${timeStr}</span>
        </div>
        <div class="order-location">MESA ${localizacao.mesa || '??'} | POSIÇÃO ${localizacao.posicao || '??'}</div>
        <p class="customer-name">${order.customer_name}</p>
        <ul class="order-items">
            ${itemsHtml}
        </ul>
        <div class="card-footer">
            <span style="color:#888; font-size: 0.8rem">Total</span>
            <span class="order-total">${formatCurrency(order.total)}</span>
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
