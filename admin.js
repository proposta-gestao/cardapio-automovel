/**
         * ♠️♦️ACP♥️♣️ - Admin Panel
         */
const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- State ---
let produtos = [];
let categorias = [];
let cupons = [];
let pedidos = [];
let imagensGaleria = [];

// --- Filtros de pedidos ---
let filtrosPedidos = {
    dataInicio: '',
    dataFim: '',
    cliente: '',
    atendente: '',
    valorMin: '',
    valorMax: '',
    status: ''
};

// --- Utils ---
function formatNumber(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- DOM ---
const $toast = document.getElementById('toast');

function showToast(msg, type = '') {
    $toast.textContent = msg;
    $toast.className = 'toast show' + (type ? ' ' + type : '');
    setTimeout(() => { $toast.className = 'toast'; }, 3000);
}

function customConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalConfirmacao');
        const btnOk = document.getElementById('btnConfirmarOk');
        const btnCancel = document.getElementById('btnConfirmarCancelar');

        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;

        modal.classList.add('active');

        const handleOk = () => {
            modal.classList.remove('active');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.remove('active');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
            resolve(false);
        };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
    });
}

function fecharModal(id) {
    document.getElementById(id).classList.remove('active');
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
}

// --- Auth ---
document.getElementById('btnLogin').onclick = async () => {
    const btn = document.getElementById('btnLogin');
    const errEl = document.getElementById('loginError');

    try {
        const email = document.getElementById('loginEmail').value.trim();
        const senha = document.getElementById('loginSenha').value;

        if (!email || !senha) {
            errEl.textContent = 'Preencha todos os campos.';
            errEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Entrando...';
        errEl.style.display = 'none';

        const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });

        if (error) {
            errEl.textContent = 'E-mail ou senha incorretos.';
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Entrar';
            return;
        }

        // Check if admin
        const { data: adminData, error: adminError } = await sb.from('admin_users').select('id').eq('user_id', data.user.id).single();

        if (adminError || !adminData) {
            errEl.textContent = 'Você não tem permissão de administrador.';
            errEl.style.display = 'block';
            await sb.auth.signOut();
            btn.disabled = false;
            btn.textContent = 'Entrar';
            return;
        }

        await showAdmin();

        // Reiniciar o botão visualmente caso deslogue depois
        btn.disabled = false;
        btn.textContent = 'Entrar';

    } catch (err) {
        errEl.textContent = 'Erro inesperado: ' + err.message;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
};

document.getElementById('btnLogout').onclick = async () => {
    await sb.auth.signOut();
    document.getElementById('adminLayout').classList.remove('visible');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginSenha').value = '';
};

// Check session on load
async function checkSession() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        const { data: adminData } = await sb.from('admin_users').select('id').eq('user_id', session.user.id).single();
        if (adminData) {
            showAdmin();
        }
    }
}
checkSession();

sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
        document.getElementById('adminLayout').classList.remove('visible');
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginSenha').value = '';
    }
});

async function showAdmin() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminLayout').classList.add('visible');
    await carregarTudo();
}

// --- Tabs ---
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab, btn);
});

// Sub-tabs handling
document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.onclick = (e) => {
        const tabContent = e.target.closest('.tab-content');
        if (!tabContent) return;
        tabContent.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
        tabContent.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('subtab-' + btn.dataset.subtab).classList.add('active');
    };
});

// --- Data Loading ---
async function carregarTudo() {
    await Promise.all([
        carregarProdutos(),
        carregarCategorias(),
        carregarCupons(),
        carregarAtendentes(),
        carregarDashboard(),
        carregarConfiguracoes()
    ]);
    renderStats();
    setupAdminRealtime();
}

async function carregarAtendentes() {
    const { data, error } = await sb.from('atendentes').select('nome').order('nome');
    if (error) { showToast('Erro ao carregar atendentes', 'error'); return; }
    const select = document.getElementById('filtroAtendente');
    if (select && data) {
        select.innerHTML = '<option value="">Todos os atendentes</option>';
        data.forEach(at => {
            const opt = document.createElement('option');
            opt.value = at.nome;
            opt.textContent = at.nome;
            select.appendChild(opt);
        });
    }
}

async function carregarDashboard() {
    const { data, error } = await sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    if (error) { showToast('Erro ao carregar pedidos', 'error'); return; }
    pedidos = data || [];

    let totalFaturado = 0;
    let totalItens = 0;

    pedidos.forEach(p => {
        totalFaturado += parseFloat(p.total);
        if (p.order_items) {
            p.order_items.forEach(item => {
                totalItens += parseInt(item.quantity);
            });
        }
    });

    document.getElementById('dashTotalValue').innerText = "R$ " + formatNumber(totalFaturado);
    document.getElementById('dashTotalOrders').innerText = pedidos.length;
    document.getElementById('dashTotalItems').innerText = totalItens;

    renderPedidosFiltrados();
}

function renderPedidosFiltrados() {
    const tbody = document.getElementById('pedidosBody');
    const contador = document.getElementById('filtroContador');

    let filtrados = pedidos.filter(p => {
        const criado = new Date(p.created_at);

        if (filtrosPedidos.dataInicio) {
            const inicio = new Date(filtrosPedidos.dataInicio + 'T00:00:00');
            if (criado < inicio) return false;
        }
        if (filtrosPedidos.dataFim) {
            const fim = new Date(filtrosPedidos.dataFim + 'T23:59:59');
            if (criado > fim) return false;
        }
        if (filtrosPedidos.cliente) {
            const query = filtrosPedidos.cliente.toLowerCase();
            const nome = (p.customer_name || '').toLowerCase();
            const celular = (p.customer_phone || '').replace(/\D/g, '');
            const queryLimpa = query.replace(/\D/g, '');

            const matchNome = nome.includes(query);
            const matchCelular = queryLimpa && celular.includes(queryLimpa);

            if (!matchNome && !matchCelular) return false;
        }
        if (filtrosPedidos.atendente) {
            if (p.atendente_nome !== filtrosPedidos.atendente) return false;
        }
        if (filtrosPedidos.valorMin !== '' && filtrosPedidos.valorMin !== null) {
            if (parseFloat(p.total) < parseFloat(filtrosPedidos.valorMin)) return false;
        }
        if (filtrosPedidos.valorMax !== '' && filtrosPedidos.valorMax !== null) {
            if (parseFloat(p.total) > parseFloat(filtrosPedidos.valorMax)) return false;
        }
        if (filtrosPedidos.status) {
            if (p.status !== filtrosPedidos.status) return false;
        }
        return true;
    });

    const total = filtrados.length;
    if (contador) {
        contador.textContent = total === pedidos.length
            ? `(${total} pedidos)`
            : `(${total} de ${pedidos.length} pedidos)`;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum pedido encontrado com os filtros selecionados.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        const dataPedido = new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const qtdItens = p.order_items ? p.order_items.reduce((acc, curr) => acc + curr.quantity, 0) : 0;
        const isPendente = p.status === 'pendente';
        const isPago = p.payment_status === 'pago';
        let badgeClass = 'badge-inactive';
        if (p.status === 'concluido') badgeClass = 'badge-active';
        if (p.status === 'cancelado') badgeClass = 'badge-danger';
        const statusLabel = p.status === 'concluido' ? 'Concluído' : p.status?.charAt(0).toUpperCase() + p.status?.slice(1);
        return `
                    <tr id="pedido-row-${p.id}">
                        <td>${dataPedido}</td>
                        <td><strong>${p.customer_name || 'Desconhecido'}</strong></td>
                        <td><span class="badge" style="background:rgba(255,255,255,0.05);color:#aaa;font-size:0.75rem;">${p.atendente_nome || '—'}</span></td>
                        <td><span class="badge ${badgeClass}" style="text-transform:capitalize;">${statusLabel}</span></td>
                        <td>${qtdItens} un.</td>
                        <td><strong>${formatCurrency(p.total)}</strong></td>
                        <td style="display:flex; gap: 5px;">
                            ${isPendente
                ? `<button class="btn-sm btn-finalizar" onclick="finalizarPedido('${p.id}')">✅ Finalizar</button>`
                : '<span style="font-size:0.8rem;color:var(--text-muted);">—</span>'
            }
                            ${isPendente && !isPago
                ? `<button class="btn-sm" style="background:transparent; color:#ff4757; border: 1px solid #ff4757;" onclick="cancelarPedido('${p.id}')">❌ Cancelar</button>`
                : ''
            }
                        </td>
                    </tr>
                `;
    }).join('');

    initSortableProdutos();
}

let adminRealtimeChannel = null;

function setupAdminRealtime() {
    if (adminRealtimeChannel) return;

    adminRealtimeChannel = sb.channel('admin-orders-realtime')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'orders' 
        }, payload => {
            if (payload.eventType === 'INSERT') {
                pedidos.unshift(payload.new);
                renderPedidosFiltrados();
            } else if (payload.eventType === 'UPDATE') {
                const idx = pedidos.findIndex(p => p.id === payload.new.id);
                if (idx !== -1) {
                    pedidos[idx] = { ...pedidos[idx], ...payload.new };
                    renderPedidosFiltrados();
                }
            } else if (payload.eventType === 'DELETE') {
                pedidos = pedidos.filter(p => p.id !== payload.old.id);
                renderPedidosFiltrados();
            }
        })
        .subscribe();
}

async function carregarProdutos() {
    const { data, error } = await sb
        .from('products')
        .select('*, categories(name)')
        .order('archived', { ascending: true })
        .order('active', { ascending: false })
        .order('sort_order', { ascending: true });
    if (error) {
        showToast('Erro ao carregar produtos', 'error');
        return;
    }
    produtos = data || [];

    // Inativar automaticamente itens com estoque 0
    const itensParaInativar = produtos.filter(p => p.active && p.stock <= 0 && !p.archived);
    if (itensParaInativar.length > 0) {
        const ids = itensParaInativar.map(p => p.id);
        const { error: updErr } = await sb.from('products').update({ active: false }).in('id', ids);
        if (!updErr) {
            // Update local state and re-render
            produtos.forEach(p => { if (ids.includes(p.id)) p.active = false; });
            showToast(`${itensParaInativar.length} item(ns) esgotados foram inativados.`, 'success');
        }
    }

    atualizarAlertaEstoque();
    renderProdutos();
    renderStats(); // Update stats summary
}

async function carregarCategorias() {
    const { data, error } = await sb.from('categories').select('*').order('order_position');
    if (error) { showToast('Erro ao carregar categorias', 'error'); return; }
    categorias = data || [];
    renderCategorias();
    atualizarSelectCategorias();
}

async function carregarCupons() {
    const { data, error } = await sb.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) { showToast('Erro ao carregar cupons', 'error'); return; }
    cupons = data || [];
    renderCupons();
}

function renderStats() {
    const ativos = produtos.filter(p => p.active && !p.archived).length;
    const totalProdutos = produtos.filter(p => !p.archived).length;
    const esgotados = produtos.filter(p => p.stock <= 0 && !p.archived).length;
    const totalCats = categorias.length;

    document.getElementById('statsRow').innerHTML = `
                <div class="stat-card"><div class="stat-label">Total de Produtos</div><div class="stat-value">${totalProdutos}</div></div>
                <div class="stat-card"><div class="stat-label">Ativos</div><div class="stat-value" style="color:var(--success)">${ativos}</div></div>
                <div class="stat-card"><div class="stat-label">Esgotados</div><div class="stat-value" style="color:var(--danger)">${esgotados}</div></div>
                <div class="stat-card"><div class="stat-label">Categorias</div><div class="stat-value">${totalCats}</div></div>
            `;
}

function atualizarAlertaEstoque() {
    const panel = document.getElementById('stockAlertPanel');
    const list = document.getElementById('stockAlertList');
    // Filtra: não arquivado AND estoque <= alerta AND estoque > 0 (zerados somem daqui pois já ficam inativos)
    const baixoEstoque = produtos.filter(p => !p.archived && p.stock <= (p.min_stock_alert || 0) && p.stock > 0);

    if (baixoEstoque.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    list.innerHTML = baixoEstoque.map(p => `
                <li>
                    <span>${p.name}</span>
                    <span>${p.stock} uni. (Mín: ${p.min_stock_alert || 0})</span>
                </li>
            `).join('');
}

// --- Render Products ---
function renderProdutos() {
    const tbody = document.getElementById('produtosBody');
    if (!tbody) return;
    if (produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum produto encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = produtos.map((p, i) => {
        const isEsgotado = p.stock <= 0;
        const canDrag = !p.archived && p.active;
        const handleContent = canDrag ? '<span class="drag-handle" style="cursor:grab;">☰</span>' : '';
        const rowStyle = canDrag ? '' : 'cursor: default;';
        let stockColor = isEsgotado ? '#FF4757' : (p.stock <= (p.min_stock_alert || 0) ? '#FAAD14' : 'inherit');

        let rowClass = '';
        if (p.archived) {
            rowClass = 'row-archived';
        } else if (!p.active) {
            rowClass = 'row-inactive';
        }

        const toggleHTML = p.archived
            ? `<span class="badge" style="background:rgba(255,255,255,0.1); color:#aaa;">Arquivado</span>`
            : `
                        <label class="switch">
                            <input type="checkbox" ${p.active ? 'checked' : ''} onchange="toggleProdutoAtivo('${p.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    `;

        const actionButton = p.archived
            ? `<button class="btn-sm btn-unarchive" onclick="desarquivarProduto('${p.id}')">Desarquivar</button>`
            : `<button class="btn-sm btn-archive" onclick="arquivarProduto('${p.id}')">Arquivar</button>`;

        return `
                <tr class="${rowClass}" data-id="${p.id}" style="${rowStyle}">
                    <td style="color: var(--text-muted); text-align: center; font-size: 1.2rem;">${handleContent}</td>
                    <td><img src="${p.image_url || 'Logo.png'}" alt="Img" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
                    <td onclick="editarProduto('${p.id}')" style="cursor:pointer;" title="Clique para editar">
                        <strong class="clickable-row-name">${p.name}</strong>
                    </td>
                    <td>${p.categories?.name || '-'}</td>
                    <td>${formatCurrency(p.price)}</td>
                    <td style="color:${stockColor}; font-weight: ${stockColor !== 'inherit' ? '700' : 'normal'}">${p.stock}</td>
                    <td>${toggleHTML}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-sm btn-edit" onclick="editarProduto('${p.id}')">Editar</button>
                            ${actionButton}
                        </div>
                    </td>
                </tr>
            `}).join('');
}

window.toggleProdutoAtivo = async (id, isActive) => {
    const { error } = await sb.from('products').update({ active: isActive }).eq('id', id);
    if (error) {
        showToast('Erro ao atualizar status', 'error');
        // Revert visual change
        carregarProdutos();
    } else {
        showToast(isActive ? 'Produto ativado!' : 'Produto inativado!', 'success');
        carregarProdutos(); // Relocates product to correct group instantly
    }
};

function initSortableProdutos() {
    const el = document.getElementById('produtosBody');
    if (!el || el.sortable) return;
    
    el.sortable = new Sortable(el, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'dragging',
        chosenClass: 'dragging',
        onStart: () => el.classList.add('is-dragging'),
        onEnd: async (evt) => {
            el.classList.remove('is-dragging');
            if (evt.oldIndex === evt.newIndex) return;

            // Reordenar o array local 'produtos' baseado na nova ordem do DOM
            const newOrderIds = Array.from(el.querySelectorAll('tr')).map(tr => tr.dataset.id);
            const reordered = newOrderIds.map(id => produtos.find(p => p.id === id));
            produtos = reordered;

            await salvarOrdemProdutosBanco();
        }
    });
}

async function salvarOrdemProdutosBanco() {
    // Apenas produtos ativos e não arquivados devem ser reordenados (conforme regra de negócio)
    // Mas aqui salvamos a ordem atual de todos para simplificar a persistência
    const updates = produtos.map((p, i) => 
        sb.from('products').update({ sort_order: i }).eq('id', p.id)
    );

    const results = await Promise.all(updates);
    if (results.some(r => r.error)) {
        showToast('Erro ao salvar nova ordem dos produtos.', 'error');
    } else {
        showToast('Ordem atualizada!', 'success');
    }
}

// --- Render Categories ---
function renderCategorias() {
    const tbody = document.getElementById('categoriasBody');
    if (categorias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhuma categoria cadastrada.</td></tr>';
        return;
    }

    tbody.innerHTML = categorias.map(c => `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td><code>${c.slug}</code></td>
                    <td>${c.order_position}</td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-sm btn-edit" onclick="editarCategoria('${c.id}')">Editar</button>
                            <button class="btn-sm btn-delete" onclick="excluirCategoria('${c.id}', '${c.name.replace(/'/g, "\\'")}')">Excluir</button>
                        </div>
                    </td>
                </tr>
            `).join('');
}

// --- Render Coupons ---
function renderCupons() {
    const tbody = document.getElementById('cuponsBody');
    if (cupons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhum cupom cadastrado.</td></tr>';
        return;
    }

    tbody.innerHTML = cupons.map(c => `
                <tr>
                    <td><strong>${c.code}</strong></td>
                    <td>${c.discount_percent}%</td>
                    <td><span class="badge ${c.active ? 'badge-active' : 'badge-inactive'}">${c.active ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-sm btn-edit" onclick="editarCupom('${c.id}')">Editar</button>
                            <button class="btn-sm btn-delete" onclick="excluirCupom('${c.id}', '${c.code}')">Excluir</button>
                        </div>
                    </td>
                </tr>
            `).join('');
}

function atualizarSelectCategorias() {
    const select = document.getElementById('prodCategoria');
    select.innerHTML = '<option value="">Selecione...</option>';
    categorias.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}

// =================== PRODUCTS CRUD ===================

async function renderizarGradeGaleria(gridId, isCompleto = false) {
    const grid = document.getElementById(gridId);
    const inputSel = document.getElementById('prodImagemSelecionada');
    const preSelecionada = inputSel.value;

    const filtroId = isCompleto ? 'filtroGaleriaCompleta' : 'filtroGaleria';
    const termoBusca = document.getElementById(filtroId).value.toLowerCase();

    let files = imagensGaleria;
    if (termoBusca) {
        files = files.filter(f => f.name.toLowerCase().includes(termoBusca));
    }

    if (files.length === 0) {
        grid.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:0.9rem;">Nenhuma foto encontrada.</div>';
        return;
    }

    let html = '';
    let limit = isCompleto ? files.length : 7;
    let filesToShow = files.slice(0, limit);

    filesToShow.forEach(file => {
        const { data: urlData } = sb.storage.from('product-images').getPublicUrl(file.name);
        const isSelected = (preSelecionada === urlData.publicUrl) ? 'selected' : '';
        html += `
                    <div class="gallery-item ${isSelected}" onclick="selecionarImagemGaleria('${urlData.publicUrl}', this, '${isCompleto}')" title="${file.name}">
                        <img src="${urlData.publicUrl}" alt="${file.name}" loading="lazy">
                    </div>
                `;
    });

    if (!isCompleto && files.length > 7) {
        html += `
                    <div class="gallery-item" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(229, 178, 93, 0.1);color:var(--primary);font-size:0.8rem;text-align:center;font-weight:800;border:1px dashed var(--primary); cursor:pointer;" onclick="abrirGaleriaCompleta()">
                        <span style="font-size:1.2rem;">+${files.length - 7}</span>
                        Ver mais imagens
                    </div>
                `;
    }
    grid.innerHTML = html;
}

async function carregarGaleria(preSelecionada = '') {
    const inputSel = document.getElementById('prodImagemSelecionada');
    inputSel.value = preSelecionada;

    const grid = document.getElementById('imageGalleryGrid');
    grid.innerHTML = '<div style="padding:1rem;color:var(--text-muted);font-size:0.9rem;">Carregando imagens...</div>';

    const { data, error } = await sb.storage.from('product-images').list();
    if (error) {
        grid.innerHTML = '<div style="color:var(--danger);font-size:0.8rem;">Erro ao carregar imagens.</div>';
        return;
    }

    imagensGaleria = data.filter(f => f.name !== '.emptyFolderPlaceholder' && f.name);
    renderizarGradeGaleria('imageGalleryGrid', false);
    if (document.getElementById('modalGaleriaCompleta').classList.contains('active')) {
        renderizarGradeGaleria('imageGalleryGridCompleta', true);
    }
}

document.getElementById('filtroGaleria').oninput = () => renderizarGradeGaleria('imageGalleryGrid', false);
document.getElementById('filtroGaleriaCompleta').oninput = () => renderizarGradeGaleria('imageGalleryGridCompleta', true);

window.abrirGaleriaCompleta = () => {
    document.getElementById('filtroGaleriaCompleta').value = '';
    renderizarGradeGaleria('imageGalleryGridCompleta', true);
    abrirModal('modalGaleriaCompleta');
};

window.selecionarImagemGaleria = (url, element, isCompletoStr) => {
    const isCompleto = isCompletoStr === 'true';
    document.getElementById('prodImagemSelecionada').value = url;

    if (isCompleto) {
        fecharModal('modalGaleriaCompleta');
        renderizarGradeGaleria('imageGalleryGrid', false);
    } else {
        document.querySelectorAll('#imageGalleryGrid .gallery-item').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
    }
};

document.getElementById('btnUploadNovaImagem').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await handleImageUpload(file);
    e.target.value = '';
};

async function handleImageUpload(file, forceUpsert = false, customName = null) {
    showToast('Enviando imagem...', 'success');
    const originalName = file.name;
    const targetName = customName || originalName;

    const { error: uploadError } = await sb.storage.from('product-images').upload(targetName, file, { upsert: forceUpsert });

    if (uploadError) {
        if (uploadError.statusCode === '409' || uploadError.message?.includes('Duplicate')) {
            const wantToReplace = await customConfirm('Substituir Imagem?', `Já existe uma imagem chamada "${targetName}".\nDeseja SUBSTITUIR a imagem existente?`);
            if (wantToReplace) {
                return await handleImageUpload(file, true, targetName);
            } else {
                const wantToRename = await customConfirm('Salvar Cópia?', "Deseja então SALVAR COMO UMA CÓPIA?");
                if (wantToRename) {
                    const lastDot = originalName.lastIndexOf('.');
                    let namePart = originalName;
                    let extPart = '';
                    if (lastDot > 0) {
                        namePart = originalName.substring(0, lastDot);
                        extPart = originalName.substring(lastDot);
                    }
                    const newName = `${namePart}_copia_${Math.floor(Math.random() * 1000)}${extPart}`;
                    return await handleImageUpload(file, false, newName);
                } else {
                    return;
                }
            }
        } else {
            showToast('Erro ao fazer upload da imagem', 'error');
            return;
        }
    }

    const { data: urlData } = sb.storage.from('product-images').getPublicUrl(targetName);
    await carregarGaleria(urlData.publicUrl);
    showToast('Imagem salva!', 'success');
}

document.getElementById('btnNovoProduto').onclick = () => {
    document.getElementById('modalProdutoTitle').textContent = 'Novo Produto';
    document.getElementById('produtoId').value = '';
    document.getElementById('prodNome').value = '';
    document.getElementById('prodDesc').value = '';
    document.getElementById('prodPreco').value = '';
    document.getElementById('prodEstoque').value = '0';
    document.getElementById('prodMovimentacaoEstoque').value = '';
    document.getElementById('prodEstoqueMin').value = '0';
    document.getElementById('prodCategoria').value = '';
    document.getElementById('prodAtivo').value = 'true';
    document.getElementById('prodImagemSelecionada').value = '';

    document.getElementById('groupEstoqueAtual').style.display = 'none';
    document.getElementById('labelMovimentacaoEstoque').innerText = 'Estoque Inicial';

    carregarGaleria('');
    abrirModal('modalProduto');
};

window.editarProduto = (id) => {
    const p = produtos.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalProdutoTitle').textContent = 'Editar Produto';
    document.getElementById('produtoId').value = p.id;
    document.getElementById('prodNome').value = p.name;
    document.getElementById('prodDesc').value = p.description || '';
    document.getElementById('prodPreco').value = p.price;
    document.getElementById('prodEstoque').value = p.stock;
    document.getElementById('prodMovimentacaoEstoque').value = '';
    document.getElementById('prodEstoqueMin').value = p.min_stock_alert;
    document.getElementById('prodCategoria').value = p.category_id;
    document.getElementById('prodAtivo').value = String(p.active);
    document.getElementById('prodImagemSelecionada').value = p.image_url || '';

    document.getElementById('groupEstoqueAtual').style.display = 'block';
    document.getElementById('labelMovimentacaoEstoque').innerText = 'Adicionar ao Estoque';

    carregarGaleria(p.image_url || '');
    abrirModal('modalProduto');
};

document.getElementById('btnSalvarProduto').onclick = async () => {
    const btn = document.getElementById('btnSalvarProduto');
    const id = document.getElementById('produtoId').value;
    const currentStock = parseInt(document.getElementById('prodEstoque').value) || 0;
    const stockInput = parseInt(document.getElementById('prodMovimentacaoEstoque').value) || 0;

    const payload = {
        name:            document.getElementById('prodNome').value.trim(),
        description:     document.getElementById('prodDesc').value.trim(),
        price:           parseFloat(document.getElementById('prodPreco').value),
        min_stock_alert: parseInt(document.getElementById('prodEstoqueMin').value) || 0,
        category_id:     document.getElementById('prodCategoria').value || null,
        active:          document.getElementById('prodAtivo').value === 'true',
        image_url:       document.getElementById('prodImagemSelecionada').value,
        updated_at:      new Date().toISOString()
    };

    if (!payload.name || isNaN(payload.price)) {
        showToast('Nome e preço são obrigatórios.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Salvando...';

    let finalStock = currentStock;
    if (!id) {
        finalStock = stockInput;
    } else {
        finalStock = currentStock + stockInput;
    }
    payload.stock = finalStock;

    let dbError;
    let savedProductId = id;

    if (id) {
        ({ error: dbError } = await sb.from('products').update(payload).eq('id', id));
    } else {
        const { data, error } = await sb.from('products').insert(payload).select().single();
        dbError = error;
        if (data) savedProductId = data.id;
    }

    if (dbError) {
        showToast('Erro ao salvar produto: ' + dbError.message, 'error');
    } else {
        // Registrar movimentação de estoque
        if (stockInput > 0 || !id) {
            await sb.from('stock_movements').insert({
                product_id: savedProductId,
                type: 'entrada',
                quantity: stockInput,
                reason: !id ? 'Estoque inicial' : 'Entrada manual'
            });
        }

        showToast(id ? 'Produto atualizado!' : 'Produto criado!', 'success');
        fecharModal('modalProduto');
        carregarProdutos();
        if (typeof renderStats === 'function') renderStats();
    }
    btn.disabled = false;
    btn.textContent = 'Salvar';
};

window.arquivarProduto = async (id) => {
    if (!await customConfirm('Arquivar Produto', 'Deseja arquivar este produto? Ele não aparecerá mais no cardápio nem no sistema.')) return;
    const { error } = await sb.from('products').update({ archived: true }).eq('id', id);
    if (error) {
        showToast('Erro ao arquivar: ' + error.message, 'error');
    } else {
        showToast('Produto arquivado!', 'success');
        carregarProdutos();
        renderStats();
    }
};

window.desarquivarProduto = async (id) => {
    if (!await customConfirm('Desarquivar Produto', 'Deseja desarquivar este produto? Ele retornará como inativo para que você possa revisá-lo antes de ativar.')) return;
    // Desarquiva e assegura que continue inativo inicialmente
    const { error } = await sb.from('products').update({ archived: false, active: false }).eq('id', id);
    if (error) {
        showToast('Erro ao desarquivar: ' + error.message, 'error');
    } else {
        showToast('Produto desarquivado com sucesso!', 'success');
        carregarProdutos();
        renderStats();
    }
};

// =================== CATEGORIES CRUD ===================

document.getElementById('btnNovaCategoria').onclick = () => {
    document.getElementById('modalCategoriaTitle').textContent = 'Nova Categoria';
    document.getElementById('catId').value = '';
    document.getElementById('catNome').value = '';
    document.getElementById('catSlug').value = '';
    document.getElementById('catOrdem').value = '';
    abrirModal('modalCategoria');
};

// Auto-generate slug from name
document.getElementById('catNome').oninput = () => {
    if (!document.getElementById('catId').value) {
        const nome = document.getElementById('catNome').value;
        document.getElementById('catSlug').value = nome.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
};

window.editarCategoria = (id) => {
    const c = categorias.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modalCategoriaTitle').textContent = 'Editar Categoria';
    document.getElementById('catId').value = c.id;
    document.getElementById('catNome').value = c.name;
    document.getElementById('catSlug').value = c.slug;
    document.getElementById('catOrdem').value = c.order_position;
    abrirModal('modalCategoria');
};

document.getElementById('btnSalvarCategoria').onclick = async () => {
    const id = document.getElementById('catId').value;
    const nome = document.getElementById('catNome').value.trim();
    const slug = document.getElementById('catSlug').value.trim();
    const ordem = parseInt(document.getElementById('catOrdem').value) || 0;

    if (!nome || !slug) {
        showToast('Preencha nome e slug.', 'error');
        return;
    }

    const payload = { name: nome, slug: slug, order_position: ordem };

    let error;
    if (id) {
        ({ error } = await sb.from('categories').update(payload).eq('id', id));
    } else {
        ({ error } = await sb.from('categories').insert(payload));
    }

    if (error) {
        showToast('Erro ao salvar categoria: ' + error.message, 'error');
        return;
    }

    showToast(id ? 'Categoria atualizada!' : 'Categoria criada!', 'success');
    fecharModal('modalCategoria');
    await carregarCategorias();
    await carregarProdutos();
    renderStats();
};

window.excluirCategoria = async (id, nome) => {
    if (!await customConfirm('Excluir Categoria', `Excluir categoria "${nome}"? Os produtos desta categoria ficarão sem categoria.`)) return;
    const { error } = await sb.from('categories').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
    showToast('Categoria excluída!', 'success');
    await carregarCategorias();
    renderStats();
};

// =================== COUPONS CRUD ===================

document.getElementById('btnNovoCupom').onclick = () => {
    document.getElementById('modalCupomTitle').textContent = 'Novo Cupom';
    document.getElementById('cupomId').value = '';
    document.getElementById('cupomCodigo').value = '';
    document.getElementById('cupomDesconto').value = '';
    document.getElementById('cupomAtivo').value = 'true';
    abrirModal('modalCupom');
};

window.editarCupom = (id) => {
    const c = cupons.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modalCupomTitle').textContent = 'Editar Cupom';
    document.getElementById('cupomId').value = c.id;
    document.getElementById('cupomCodigo').value = c.code;
    document.getElementById('cupomDesconto').value = c.discount_percent;
    document.getElementById('cupomAtivo').value = String(c.active);
    abrirModal('modalCupom');
};

document.getElementById('btnSalvarCupom').onclick = async () => {
    const id = document.getElementById('cupomId').value;
    const codigo = document.getElementById('cupomCodigo').value.trim().toUpperCase();
    const desconto = parseFloat(document.getElementById('cupomDesconto').value);
    const ativo = document.getElementById('cupomAtivo').value === 'true';

    if (!codigo || isNaN(desconto) || desconto <= 0 || desconto > 100) {
        showToast('Preencha código e desconto corretamente (1-100%).', 'error');
        return;
    }

    const payload = { code: codigo, discount_percent: desconto, active: ativo };

    let error;
    if (id) {
        ({ error } = await sb.from('coupons').update(payload).eq('id', id));
    } else {
        ({ error } = await sb.from('coupons').insert(payload));
    }

    if (error) {
        showToast('Erro ao salvar cupom: ' + error.message, 'error');
        return;
    }

    showToast(id ? 'Cupom atualizado!' : 'Cupom criado!', 'success');
    fecharModal('modalCupom');
    await carregarCupons();
};

window.excluirCupom = async (id, code) => {
    if (!await customConfirm('Excluir Cupom', `Excluir cupom "${code}"?`)) return;
    const { error } = await sb.from('coupons').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
    showToast('Cupom excluído!', 'success');
    await carregarCupons();
};

// Enter to login
document.getElementById('loginSenha').onkeydown = (e) => {
    if (e.key === 'Enter') document.getElementById('btnLogin').click();
};

// --- Filtros de Pedidos ---
document.getElementById('btnAplicarFiltros').onclick = () => {
    filtrosPedidos = {
        dataInicio: document.getElementById('filtroDataInicio').value,
        dataFim: document.getElementById('filtroDataFim').value,
        cliente: document.getElementById('filtroCliente').value.trim(),
        atendente: document.getElementById('filtroAtendente').value,
        valorMin: document.getElementById('filtroValorMin').value,
        valorMax: document.getElementById('filtroValorMax').value,
        status: document.getElementById('filtroStatus').value
    };
    renderPedidosFiltrados();
};

document.getElementById('btnLimparFiltros').onclick = () => {
    filtrosPedidos = { dataInicio: '', dataFim: '', cliente: '', atendente: '', valorMin: '', valorMax: '', status: '' };
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    document.getElementById('filtroCliente').value = '';
    document.getElementById('filtroAtendente').value = '';
    document.getElementById('filtroValorMin').value = '';
    document.getElementById('filtroValorMax').value = '';
    document.getElementById('filtroStatus').value = '';
    renderPedidosFiltrados();
};

// --- Finalizar Pedido ---
window.finalizarPedido = async (id) => {
    if (!await customConfirm('Concluir Pedido', 'Deseja marcar este pedido como Concluído?')) return;
    const { error } = await sb.from('orders').update({ status: 'concluido' }).eq('id', id);
    if (error) {
        showToast('Erro ao finalizar pedido: ' + error.message, 'error');
        return;
    }
    // Atualiza o pedido na memória
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx !== -1) pedidos[idx].status = 'concluido';
    renderPedidosFiltrados();
    showToast('Pedido finalizado com sucesso!', 'success');
};

// --- Cancelar Pedido ---
window.cancelarPedido = (id) => {
    document.getElementById('cancelOrderId').value = id;
    
    // popular select
    const select = document.getElementById('selectCancelReason');
    select.innerHTML = '<option value="">Selecione um motivo...</option>' + 
        cancellationReasons.map(r => `<option value="${r}">${r}</option>`).join('');

    abrirModal('modalCancelarPedido');
};

document.getElementById('btnConfirmarCancelamento').onclick = async () => {
    const id = document.getElementById('cancelOrderId').value;
    const reason = document.getElementById('selectCancelReason').value;

    if (!reason) {
        showToast('Por favor, selecione um motivo para o cancelamento.', 'error');
        return;
    }

    const btn = document.getElementById('btnConfirmarCancelamento');
    btn.disabled = true;
    btn.innerText = 'Cancelando...';

    const { error } = await sb.from('orders').update({ status: 'cancelado', cancellation_reason: reason }).eq('id', id);
    if (error) {
        showToast('Erro ao cancelar pedido: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerText = 'Confirmar Cancelamento';
        return;
    }

    // Atualiza o pedido na memória
    const idx = pedidos.findIndex(p => p.id === id);
    if (idx !== -1) {
        pedidos[idx].status = 'cancelado';
        pedidos[idx].cancellation_reason = reason;
    }
    renderPedidosFiltrados();
    showToast('Pedido cancelado com sucesso!', 'success');
    fecharModal('modalCancelarPedido');
    
    btn.disabled = false;
    btn.innerText = 'Confirmar Cancelamento';
};

// =================== CONFIGURAÇÕES ===================

let zonasEntrega = [];
let cancellationReasons = [];

// --- Toggle de visibilidade do campo de URL ---
window.toggleUrlInput = (containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

async function carregarConfiguracoes() {
    const [settingsRes, zonasRes] = await Promise.all([
        sb.from('store_settings').select('*').single(),
        sb.from('shipping_zones').select('*').order('created_at')
    ]);

    if (settingsRes.error && settingsRes.error.code !== 'PGRST116') {
        showToast('Erro ao carregar configurações', 'error');
    }

    if (settingsRes.data) {
        const d = settingsRes.data;
        // Endereço
        document.getElementById('confNomeLoja').value        = d.store_name || '';
        document.getElementById('confCep').value             = d.address_zip || '';
        document.getElementById('confLogradouro').value      = d.address_street || '';
        document.getElementById('confNumero').value          = d.address_number || '';
        document.getElementById('confComplemento').value     = d.address_complement || '';
        document.getElementById('confBairro').value          = d.address_neighborhood || '';
        document.getElementById('confCidade').value          = d.address_city || '';
        document.getElementById('confEstado').value          = d.address_state || '';
        document.getElementById('confReferencia').value      = d.address_reference || '';

        // Personalização Visual
        document.getElementById('confBrandName').value       = d.brand_name || '';
        document.getElementById('confBrandSubtitle').value   = d.brand_subtitle || '';
        document.getElementById('confBannerUrl').value       = d.banner_url || '';
        document.getElementById('confLogoUrl').value         = d.logo_url || '';
        atualizarPreviewBanner(d.banner_url || '');
        atualizarPreviewLogo(d.logo_url || '');

        // Frete
        const freteAtivo = !!d.frete_ativo;
        document.getElementById('confFreteAtivo').checked    = freteAtivo;
        document.getElementById('freteZonasContainer').style.display = freteAtivo ? 'block' : 'none';

        // Justificativas
        let cr = d.cancellation_reasons;
        if (typeof cr === 'string') {
            try { cr = JSON.parse(cr); } catch(e) { cr = []; }
        }
        cancellationReasons = Array.isArray(cr) ? cr : [];
        renderJustificativas();
    }

    if (!zonasRes.error) {
        zonasEntrega = zonasRes.data || [];
        renderZonasFrete();
    }
}

// --- Preview de imagem ---
function atualizarPreviewBanner(url) {
    const el = document.getElementById('previewBanner');
    const placeholder = el.querySelector('.visual-preview-placeholder');
    if (url) {
        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        el.style.backgroundImage = '';
        if (placeholder) placeholder.style.display = '';
    }
}

function atualizarPreviewLogo(url) {
    const el = document.getElementById('previewLogo');
    const placeholder = el.querySelector('.visual-preview-placeholder');
    if (url) {
        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'center';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        el.style.backgroundImage = '';
        if (placeholder) placeholder.style.display = '';
    }
}

// --- Upload de imagem de visual (banner/logo) ---
async function handleVisualImageUpload(file, tipo) {
    showToast('Enviando imagem...', 'success');
    const targetName = `visual_${tipo}_${Date.now()}_${file.name}`;
    const { error } = await sb.storage.from('product-images').upload(targetName, file, { upsert: true });
    if (error) { showToast('Erro ao enviar imagem: ' + error.message, 'error'); return null; }
    const { data: urlData } = sb.storage.from('product-images').getPublicUrl(targetName);
    return urlData.publicUrl;
}

document.getElementById('uploadBanner').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await handleVisualImageUpload(file, 'banner');
    if (url) {
        document.getElementById('confBannerUrl').value = url;
        atualizarPreviewBanner(url);
    }
    e.target.value = '';
};

document.getElementById('uploadLogo').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await handleVisualImageUpload(file, 'logo');
    if (url) {
        document.getElementById('confLogoUrl').value = url;
        atualizarPreviewLogo(url);
    }
    e.target.value = '';
};

document.getElementById('btnAplicarUrlBanner').onclick = () => {
    const url = document.getElementById('confBannerUrl').value.trim();
    atualizarPreviewBanner(url);
    if(url) toggleUrlInput('containerBannerUrl');
};

document.getElementById('btnAplicarUrlLogo').onclick = () => {
    const url = document.getElementById('confLogoUrl').value.trim();
    atualizarPreviewLogo(url);
    if(url) toggleUrlInput('containerLogoUrl');
};

// --- Salvar Personalização Visual ---
document.getElementById('btnSalvarPersonalizacao').onclick = async () => {
    const btn = document.getElementById('btnSalvarPersonalizacao');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const payload = {
        id: 1,
        brand_name:     document.getElementById('confBrandName').value.trim(),
        brand_subtitle: document.getElementById('confBrandSubtitle').value.trim(),
        banner_url:     document.getElementById('confBannerUrl').value.trim(),
        logo_url:       document.getElementById('confLogoUrl').value.trim(),
        updated_at:     new Date().toISOString()
    };

    const { error } = await sb.from('store_settings').upsert(payload);
    if (error) {
        showToast('Erro ao salvar visual: ' + error.message, 'error');
    } else {
        showToast('Personalização visual salva!', 'success');
    }
    btn.disabled = false;
    btn.textContent = 'Salvar Visual';
};

// --- Toggle Frete ---
document.getElementById('confFreteAtivo').onchange = async function () {
    const ativo = this.checked;
    document.getElementById('freteZonasContainer').style.display = ativo ? 'block' : 'none';

    const { error } = await sb.from('store_settings').upsert({
        id: 1,
        frete_ativo: ativo,
        updated_at: new Date().toISOString()
    });
    if (error) {
        showToast('Erro ao salvar configuração de frete: ' + error.message, 'error');
    } else {
        showToast(ativo ? '🚚 Frete habilitado!' : 'Frete desabilitado.', 'success');
    }
};

// --- Render Zonas de Frete ---
function renderZonasFrete() {
    const tbody = document.getElementById('zonasBody');
    if (!tbody) return;
    if (zonasEntrega.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">Nenhuma zona cadastrada.</td></tr>';
        return;
    }
    tbody.innerHTML = zonasEntrega.map(z => `
        <tr>
            <td><strong>${z.name}</strong></td>
            <td><span style="font-size:0.85rem; color:var(--text-muted);">${z.neighborhoods || '—'}</span></td>
            <td>
                <div class="fee-editable" onclick="window.tornarFeeEditavel(this, '${z.id}')" title="Clique para editar taxa">
                    <strong>${formatCurrency(z.fee)}</strong>
                </div>
            </td>
            <td><span class="badge ${z.active ? 'badge-active' : 'badge-inactive'}">${z.active ? 'Ativa' : 'Inativa'}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn-sm btn-edit" onclick="editarZona('${z.id}')">Editar</button>
                    <button class="btn-sm btn-delete" onclick="excluirZona('${z.id}', '${z.name.replace(/'/g, "\\'")}')">Excluir</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// --- Edição de Taxa Inline ---
window.tornarFeeEditavel = (el, id) => {
    if (el.querySelector('input')) return;
    const valorAtual = parseFloat(el.textContent.replace('R$', '').replace('.', '').replace(',', '.').trim());
    el.innerHTML = `<input type="number" step="0.01" class="inline-fee-input" value="${valorAtual}" onblur="window.salvarTaxaInline(this, '${id}')" onkeydown="if(event.key==='Enter') this.blur()">`;
    const input = el.querySelector('input');
    input.focus();
    input.select();
};

window.salvarTaxaInline = async (input, id) => {
    const novoValor = parseFloat(input.value);
    if (isNaN(novoValor)) {
        renderZonasFrete(); // Reverte se inválido
        return;
    }
    
    // Feedback visual imediato
    const container = input.parentElement;
    container.innerHTML = '<span style="font-size:0.8rem;opacity:0.6;">⏳...</span>';

    const { error } = await sb.from('shipping_zones').update({ fee: novoValor }).eq('id', id);
    if (error) {
        showToast('Erro ao salvar taxa: ' + error.message, 'error');
        renderZonasFrete();
    } else {
        const zona = zonasEntrega.find(z => z.id === id);
        if (zona) zona.fee = novoValor;
        renderZonasFrete();
        showToast('Taxa atualizada!', 'success');
    }
};

// --- CRUD Zonas de Frete ---
document.getElementById('btnNovaZona').onclick = () => {
    document.getElementById('modalZonaTitulo').textContent = 'Nova Zona de Entrega';
    document.getElementById('zonaId').value = '';
    document.getElementById('zonaNome').value = '';
    document.getElementById('zonaNeighborhoods').value = '';
    document.getElementById('zonaFee').value = '';
    document.getElementById('zonaAtivo').value = 'true';
    abrirModal('modalZona');
};

window.editarZona = (id) => {
    const z = zonasEntrega.find(x => x.id === id);
    if (!z) return;
    document.getElementById('modalZonaTitulo').textContent = 'Editar Zona';
    document.getElementById('zonaId').value = z.id;
    document.getElementById('zonaNome').value = z.name;
    document.getElementById('zonaNeighborhoods').value = z.neighborhoods || '';
    document.getElementById('zonaFee').value = z.fee;
    document.getElementById('zonaAtivo').value = String(z.active);
    abrirModal('modalZona');
};

document.getElementById('btnSalvarZona').onclick = async () => {
    const btn = document.getElementById('btnSalvarZona');
    const id = document.getElementById('zonaId').value;
    const nome = document.getElementById('zonaNome').value.trim();
    const neighborhoods = document.getElementById('zonaNeighborhoods').value.trim();
    const fee = parseFloat(document.getElementById('zonaFee').value);
    const ativo = document.getElementById('zonaAtivo').value === 'true';

    if (!nome || !neighborhoods || isNaN(fee) || fee < 0) {
        showToast('Preencha o nome da zona, os bairros e a taxa.', 'error');
        return;
    }

    const payload = {
        name: nome,
        neighborhoods: neighborhoods,
        fee,
        active: ativo
    };

    btn.disabled = true;
    btn.textContent = 'Salvando...';

    let error;
    if (id) {
        ({ error } = await sb.from('shipping_zones').update(payload).eq('id', id));
    } else {
        ({ error } = await sb.from('shipping_zones').insert(payload));
    }

    if (error) {
        showToast('Erro ao salvar: ' + error.message, 'error');
    } else {
        showToast(id ? 'Bairro atualizado!' : 'Bairro criado!', 'success');
        fecharModal('modalZona');
        const { data } = await sb.from('shipping_zones').select('*').order('name');
        zonasEntrega = data || [];
        renderZonasFrete();
    }
    btn.disabled = false;
    btn.textContent = 'Salvar';
};

window.excluirZona = async (id, nome) => {
    if (!await customConfirm('Excluir Zona', `Excluir a zona "${nome}"?`)) return;
    const { error } = await sb.from('shipping_zones').delete().eq('id', id);
    if (error) { showToast('Erro ao excluir: ' + error.message, 'error'); return; }
    showToast('Zona excluída!', 'success');
    zonasEntrega = zonasEntrega.filter(z => z.id !== id);
    renderZonasFrete();
};

// --- Geolocalização Helper ---
async function getCoordinates(address) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
    } catch (e) { console.error("Erro geocoding: ", e); }
    return null;
}

document.getElementById('btnSalvarConfig').onclick = async () => {
    const btn = document.getElementById('btnSalvarConfig');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const payload = {
        id: 1,
        store_name:           document.getElementById('confNomeLoja').value.trim(),
        address_zip:          document.getElementById('confCep').value.trim(),
        address_street:       document.getElementById('confLogradouro').value.trim(),
        address_number:       document.getElementById('confNumero').value.trim(),
        address_complement:   document.getElementById('confComplemento').value.trim(),
        address_neighborhood: document.getElementById('confBairro').value.trim(),
        address_city:         document.getElementById('confCidade').value.trim(),
        address_state:        document.getElementById('confEstado').value.trim(),
        address_reference:    document.getElementById('confReferencia').value.trim(),
        updated_at:           new Date().toISOString()
    };

    const { error } = await sb.from('store_settings').upsert(payload);
    if (error) {
        showToast('Erro ao salvar: ' + error.message, 'error');
    } else {
        showToast('Configurações salvas!', 'success');
    }
    btn.disabled = false;
    btn.textContent = 'Salvar Configurações';
};

document.getElementById('btnBuscarCepConfig').onclick = async () => {
    const cep = document.getElementById('confCep').value.replace(/\D/g, '');
    if (cep.length !== 8) { showToast('CEP inválido.', 'error'); return; }
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (!data.erro) {
            document.getElementById('confLogradouro').value = data.logradouro || '';
            document.getElementById('confBairro').value = data.bairro || '';
            document.getElementById('confCidade').value = data.localidade || '';
            document.getElementById('confEstado').value = data.uf || '';
            document.getElementById('confNumero').focus();
        } else {
            showToast('CEP não encontrado.', 'error');
        }
    } catch { showToast('Erro ao buscar CEP.', 'error'); }
};

document.getElementById('confCep').oninput = (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
    e.target.value = v;
};

// --- Justificativas de Cancelamento ---
function renderJustificativas() {
    const tbody = document.getElementById('justificativasBody');
    if (!tbody) return;
    if (cancellationReasons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:1rem;">Nenhuma justificativa cadastrada.</td></tr>';
        return;
    }
    
    tbody.innerHTML = cancellationReasons.map((r, i) => `
        <tr class="justificativa-row" data-index="${i}">
            <td style="color: var(--text-muted); text-align: center; font-size: 1.2rem;"><span class="drag-handle-just" style="cursor:grab;">☰</span></td>
            <td>${r}</td>
            <td>
                <button class="btn-sm btn-delete" onclick="removerJustificativa(${i})">Excluir</button>
            </td>
        </tr>
    `).join('');

    initSortableJustificativas();
}

function initSortableJustificativas() {
    const el = document.getElementById('justificativasBody');
    if (!el || el.sortable) return;

    el.sortable = new Sortable(el, {
        animation: 150,
        handle: '.drag-handle-just',
        ghostClass: 'sortable-ghost',
        dragClass: 'dragging',
        chosenClass: 'dragging',
        onStart: () => el.classList.add('is-dragging'),
        onEnd: async (evt) => {
            el.classList.remove('is-dragging');
            if (evt.oldIndex === evt.newIndex) return;

            // Reordenar baseado no novo estado do DOM
            const newOrder = Array.from(el.querySelectorAll('.justificativa-row')).map(tr => {
                const idx = parseInt(tr.dataset.index);
                return cancellationReasons[idx];
            });
            cancellationReasons = newOrder;

            renderJustificativas(); // Re-render para atualizar os data-index
            await salvarJustificativasNoBanco();
            showToast('Ordem atualizada!', 'success');
        }
    });
}

let draggedItemIndex = null;

// Removido drag functions manuais em favor do SortableJS

async function salvarJustificativasNoBanco() {
    const { error } = await sb.from('store_settings').update({
        cancellation_reasons: cancellationReasons,
        updated_at: new Date().toISOString()
    }).eq('id', 1);

    if (error) {
        showToast('Erro ao salvar justificativas: ' + error.message, 'error');
    }
}

document.getElementById('btnAdicionarJustificativa').onclick = async () => {
    const input = document.getElementById('inputNovaJustificativa');
    const val = input.value.trim();
    if (!val) return;
    if (cancellationReasons.includes(val)) {
        showToast('Esta justificativa já existe.', 'error');
        return;
    }
    
    document.getElementById('btnAdicionarJustificativa').disabled = true;
    cancellationReasons.push(val);
    input.value = '';
    renderJustificativas();
    
    await salvarJustificativasNoBanco();
    showToast('Justificativa adicionada!', 'success');
    document.getElementById('btnAdicionarJustificativa').disabled = false;
};

window.removerJustificativa = async (index) => {
    cancellationReasons.splice(index, 1);
    renderJustificativas();
    await salvarJustificativasNoBanco();
    showToast('Justificativa removida!', 'success');
};