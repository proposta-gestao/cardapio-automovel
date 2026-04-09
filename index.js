/**
 * ♠️♦️ACP♥️♣️ - Cardápio Digital
 * Integrado com Supabase: produtos, categorias, cupons e configurações dinâmicas
 */

// --- Supabase ---
const SUPABASE_URL = 'https://bpwwdnmhryblhsnywyoz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3dkbm1ocnlibGhzbnl3eW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTM4NTksImV4cCI6MjA5MTMyOTg1OX0.AKJAzeYdbiiUyGxiWS4QeU5m3URel6kwsLnP6eGbXLg';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Configurações ---
const CONFIG = { telefone: "5531975540280" };

// --- Utils ---
function formatNumber(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(val) {
    return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- Dados dinâmicos (Supabase) ---
let PRODUTOS = [];
let CATEGORIAS = [];
let CUPONS = [];
let ZONAS_FRETE = [];
let CONFIG_LOJA = null;

// --- Estado da Aplicação ---
let state = {
    carrinho: [],
    produtoSelecionado: null,
    quantidadeAtual: 1,
    descontoAtivo: 0,
    cupomAplicado: null,
    categoriaAtiva: 'todos',
    termoBusca: '',
    tipoEntrega: 'mesa',      // Sempre 'mesa' agora
    freteAtivo: 0             // Sempre 0 agora
};

// --- Seletores DOM ---
const dom = {
    menu: document.getElementById("menu"),
    cart: document.getElementById("cart"),
    cartItems: document.getElementById("cartItems"),
    contador: document.getElementById("contador"),
    total: document.getElementById("total"),
    popup: document.getElementById("popup"),
    backdrop: document.getElementById("backdrop"),
    busca: document.getElementById("busca"),
    categoriesList: document.getElementById("categoriesList"),
    qntText: document.getElementById("qnt"),
    pImg: document.getElementById("pimg"),
    pNome: document.getElementById("pnome"),
    pDesc: document.getElementById("pdesc"),
    pPreco: document.getElementById("ppreco")
};

// =============================================
// CARREGAMENTO DO SUPABASE
// =============================================

// --- Inicialização de Dados Salvos ---
function carregarDadosSalvos() {
    const nome = localStorage.getItem('acp_nome');
    const telefone = localStorage.getItem('acp_telefone');
    
    if (nome) {
        const inputNome = document.getElementById('clienteNome');
        if (inputNome) inputNome.value = nome;
    }
    if (telefone) {
        const inputTelefone = document.getElementById('clienteTelefone');
        if (inputTelefone) inputTelefone.value = telefone;
    }
}

async function inicializar() {
    dom.menu.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:3rem;">Carregando cardápio...</p>';
    try {
        carregarDadosSalvos();
        await Promise.all([
            carregarCategorias(),
            carregarProdutos(),
            carregarCupons(),
            carregarConfiguracoesPublicas()
        ]);
    } catch (e) {
        dom.menu.innerHTML = '<p style="text-align:center;color:#FF4757;padding:3rem;">Erro ao carregar o cardápio. Tente recarregar a página.</p>';
    }
}

async function carregarCategorias() {
    const { data, error } = await sb
        .from('categories')
        .select('*')
        .order('order_position');
    if (error) throw error;
    CATEGORIAS = data || [];
    renderCategorias();
}

async function carregarProdutos() {
    const { data, error } = await sb
        .from('products')
        .select('*, categories(name, slug)')
        .eq('active', true)
        .or('archived.is.null,archived.eq.false')
        .order('created_at');
    if (error) throw error;
    PRODUTOS = (data || []).map(p => ({
        id: p.id,
        nome: p.name,
        desc: p.description || '',
        preco: parseFloat(p.price),
        img: p.image_url || 'Logo.png',
        stock: p.stock,
        cat: p.categories?.name || '',
        catSlug: p.categories?.slug || ''
    }));
    renderMenu();
}

async function carregarCupons() {
    const { data, error } = await sb
        .from('coupons')
        .select('code, discount_percent')
        .eq('active', true);
    if (error) throw error;
    CUPONS = data || [];
}

async function carregarConfiguracoesPublicas() {
    const [settingsRes, zonesRes] = await Promise.all([
        sb.from('store_settings').select('*').single(),
        sb.from('shipping_zones').select('*').eq('active', true)
    ]);
    if (!settingsRes.error && settingsRes.data) {
        CONFIG_LOJA = settingsRes.data;
    }
    if (!zonesRes.error) {
        ZONAS_FRETE = zonesRes.data || [];
    }
}

// =============================================
// RENDERIZAÇÃO
// =============================================

function renderCategorias() {
    dom.categoriesList.innerHTML = '<button class="cat-btn active" data-cat="todos">Todos</button>';
    CATEGORIAS.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.dataset.cat = cat.name;
        btn.textContent = cat.name;
        dom.categoriesList.appendChild(btn);
    });
    vincularFiltros();
}

function renderMenu() {
    const filtrados = PRODUTOS.filter(p => {
        const matchBusca = p.nome.toLowerCase().includes(state.termoBusca.toLowerCase());
        const matchCat = state.categoriaAtiva === 'todos' || p.cat === state.categoriaAtiva;
        return matchBusca && matchCat;
    });

    // Ordena: disponíveis primeiro, esgotados no final
    filtrados.sort((a, b) => {
        const aEsg = a.stock <= 0 ? 1 : 0;
        const bEsg = b.stock <= 0 ? 1 : 0;
        return aEsg - bEsg;
    });

    if (filtrados.length === 0) {
        dom.menu.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:3rem;">Nenhum produto encontrado.</p>';
        return;
    }

    dom.menu.innerHTML = filtrados.map(p => {
        const esgotado = p.stock <= 0;
        return `
        <article class="product-card${esgotado ? ' esgotado' : ''}" ${esgotado ? '' : `onclick="abrirModal('${p.id}')"`}>
            <div class="product-img-wrap">
                <img src="${p.img}" alt="${p.nome}" loading="lazy">
                ${esgotado ? '<span class="badge-esgotado">Esgotado</span>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-name">${p.nome}</h3>
                <div class="product-footer">
                    <span class="product-price">${formatCurrency(p.preco)}</span>
                    <button class="btn-add" ${esgotado ? 'disabled' : ''}>
                        ${esgotado ? 'Esgotado' : 'Adicionar'}
                    </button>
                </div>
            </div>
        </article>
        `;
    }).join('');
}

function renderCarrinho() {
    const btnProx = document.getElementById('btnProximaEtapa');

    if (state.carrinho.length === 0) {
        dom.cartItems.innerHTML = '<div class="empty-cart-msg">Seu carrinho está vazio.</div>';
        dom.contador.innerText = "0";
        if (dom.total) dom.total.innerText = "0,00"; // keep this as just value if the UI expects it without label
        if (btnProx) btnProx.disabled = true;
        renderTotalBreakdown();
        return;
    }

    let subtotal = 0;
    dom.cartItems.innerHTML = state.carrinho.map((item, index) => {
        const itemTotal = item.preco * item.qnt;
        subtotal += itemTotal;
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.qnt}x ${item.nome}</h4>
                    <p>${item.obs ? `Obs: ${item.obs}` : ''}</p>
                    <strong>${formatCurrency(itemTotal)}</strong>
                </div>
                <div class="cart-item-actions">
                    <button class="btn-remove" onclick="removerDoCarrinho(${index})" aria-label="Remover item">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    const totalFinal = subtotal * (1 - state.descontoAtivo);
    if (dom.total) dom.total.innerText = formatNumber(totalFinal);
    dom.contador.innerText = state.carrinho.reduce((acc, curr) => acc + curr.qnt, 0);
    if (btnProx) btnProx.disabled = false;
    renderTotalBreakdown();
}

// =============================================
// WIZARD — ETAPAS DO CHECKOUT
// =============================================

function navegarStep(n) {
    const step1 = document.getElementById('wizardStep1');
    const step2 = document.getElementById('wizardStep2');
    const dot1 = document.getElementById('stepDot1');
    const dot2 = document.getElementById('stepDot2');
    const line = document.getElementById('stepLine');

    if (n === 1) {
        step1.classList.add('active');
        step2.classList.remove('active');
        dot1.className = 'step-dot active';
        dot1.textContent = '1';
        dot2.className = 'step-dot';
        dot2.textContent = '2';
        if (line) line.style.background = 'var(--border-color)';
    } else {
        step1.classList.remove('active');
        step2.classList.add('active');
        dot1.className = 'step-dot done';
        dot1.textContent = '✓';
        dot2.className = 'step-dot active';
        dot2.textContent = '2';
        if (line) line.style.background = 'var(--primary)';
        renderTotalBreakdown();
        // Inicializa o bloco de entrega selecionado
        toggleTipoEntrega(state.tipoEntrega);
    }
}

// =============================================
// FRETE (DESATIVADO)
// =============================================

function normalizar(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function calcularFrete(bairro) {
    return 0;
}

// =============================================
// TOTAL BREAKDOWN
// =============================================

function renderTotalBreakdown() {
    const subtotal = state.carrinho.reduce((acc, p) => acc + (p.preco * p.qnt), 0);
    const desconto = subtotal * state.descontoAtivo;
    const subtotalFinal = subtotal - desconto;

    const fmt = (v) => formatCurrency(v);
    const fmtNum = (v) => formatNumber(v);

    // --- Etapa 1: breakdown do cupom ---
    const couponBreakdown = document.getElementById('couponBreakdown');
    const cbTotal = document.getElementById('cbTotal');
    const cbDesconto = document.getElementById('cbDesconto');
    const cbSubfinal = document.getElementById('cbSubfinal');

    if (couponBreakdown) {
        if (desconto > 0) {
            couponBreakdown.style.display = 'block';
            if (cbTotal)    cbTotal.textContent    = fmt(subtotal);
            if (cbDesconto) cbDesconto.textContent = `- ${fmt(desconto)}`;
            if (cbSubfinal) cbSubfinal.textContent = fmt(subtotalFinal);
        } else {
            couponBreakdown.style.display = 'none';
        }
    }

    // Atualiza subtotal da etapa 1 (com desconto aplicado)
    if (dom.total) {
        dom.total.innerText = fmtNum(subtotalFinal);
    }

    const els = {
        sub:       document.getElementById('breakdownSubtotal'),
        descRow:   document.getElementById('rowDesconto'),
        desc:      document.getElementById('breakdownDesconto'),
        freteRow:  document.getElementById('rowFrete'),
        frete:     document.getElementById('breakdownFrete'),
        tot:       document.getElementById('breakdownTotal'),
    };
    if (!els.sub) return; // etapa 2 não visível ainda

    els.sub.textContent = fmt(subtotal);

    // Linha de desconto
    if (desconto > 0) {
        els.desc.textContent = `- ${fmt(desconto)}`;
        els.desc.style.color = '#00B894';
        els.descRow.style.display = 'flex';
    } else {
        els.descRow.style.display = 'none';
    }

    // Linha de frete (oculta agora)
    if (els.freteRow) els.freteRow.style.display = 'none';

    els.tot.textContent = fmt(subtotal - desconto);
}

// =============================================
// CEP — AUTOCOMPLETE DEBOUNCED (sem botão)
// =============================================

// =============================================
// CEP (DESATIVADO)
// =============================================

function onCepInput(e) {}
async function buscarCepAuto() {}

// =============================================
// AÇÕES DO CARRINHO
// =============================================

window.abrirModal = (id) => {
    const produto = PRODUTOS.find(p => p.id === id);
    if (!produto || produto.stock <= 0) return;
    state.produtoSelecionado = produto;
    state.quantidadeAtual = 1;

    dom.pImg.src = produto.img;
    dom.pNome.innerText = produto.nome;
    dom.pDesc.innerText = produto.desc;
    dom.pPreco.innerText = formatNumber(produto.preco);
    dom.qntText.innerText = state.quantidadeAtual;
    atualizarSubtotalModal();
    
    document.getElementById("obs").value = "";
    document.getElementById("confirmar").style.display = "block";
    document.getElementById("postAddActions").style.display = "none";

    toggleModal(true);
};

function atualizarSubtotalModal() {
    if (!state.produtoSelecionado) return;
    const sub = state.produtoSelecionado.preco * state.quantidadeAtual;
    document.getElementById('psubtotal').innerText = formatNumber(sub);
}

function toggleModal(show) {
    dom.popup.classList.toggle('active', show);
    dom.backdrop.classList.toggle('active', show);
}

window.removerDoCarrinho = (index) => {
    state.carrinho.splice(index, 1);
    renderCarrinho();
};

// =============================================
// EVENT LISTENERS
// =============================================

// Quantidade no Modal
document.getElementById("mais").onclick = () => {
    const maxQty = state.produtoSelecionado?.stock || 0;
    if (state.quantidadeAtual < maxQty) {
        state.quantidadeAtual++;
        dom.qntText.innerText = state.quantidadeAtual;
        atualizarSubtotalModal();
    } else {
        alert("Quantidade máxima em estoque atingida!");
    }
};

document.getElementById("menos").onclick = () => {
    if (state.quantidadeAtual > 1) {
        state.quantidadeAtual--;
        dom.qntText.innerText = state.quantidadeAtual;
        atualizarSubtotalModal();
    }
};

// Adicionar ao Carrinho
document.getElementById("confirmar").onclick = () => {
    const obs = document.getElementById("obs").value;
    state.carrinho.push({ ...state.produtoSelecionado, qnt: state.quantidadeAtual, obs });
    renderCarrinho();
    document.getElementById("confirmar").style.display = "none";
    document.getElementById("postAddActions").style.display = "flex";
};

document.getElementById("btnContinuar").onclick = () => toggleModal(false);
document.getElementById("btnIrCarrinho").onclick = () => { toggleModal(false); toggleCart(true); };

// Filtros de Categoria
function vincularFiltros() {
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.categoriaAtiva = btn.dataset.cat;
            renderMenu();
        };
    });
}

// Busca
dom.busca.onkeyup = (e) => {
    state.termoBusca = e.target.value;
    renderMenu();
};

// Cupom
document.getElementById("btnCupom").onclick = async () => {
    const codigo = document.getElementById("cupom").value.trim().toUpperCase();
    if (!codigo) return;

    const cupom = CUPONS.find(c => c.code === codigo);
    if (cupom) {
        state.descontoAtivo = parseFloat(cupom.discount_percent) / 100;
        state.cupomAplicado = codigo;
        mostrarToast(`🎉 Cupom "${codigo}" aplicado! ${cupom.discount_percent}% de desconto.`, 'success');
        renderCarrinho();
    } else {
        mostrarToast('❌ Cupom inválido ou expirado. Tente outro!', 'error');
    }
};

// CEP (REMOVIDO)
const cepInput = document.getElementById("cep");
if (cepInput) cepInput.oninput = onCepInput;

// Tipo de Entrega (OCULTO)
function toggleTipoEntrega(tipo) {}

// Wizard — Navegação
document.getElementById("btnProximaEtapa").onclick = () => {
    if (state.carrinho.length === 0) return;
    navegarStep(2);
};

document.getElementById("btnVoltarEtapa").onclick = () => navegarStep(1);

// Limitar telefone a 11 dígitos numéricos
const telInput = document.getElementById('clienteTelefone');
if (telInput) {
    telInput.addEventListener('input', () => {
        let digits = telInput.value.replace(/\D/g, '').slice(0, 11);
        // Formata: (XX) XXXXX-XXXX
        let formatted = digits;
        if (digits.length > 2)  formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
        if (digits.length > 7)  formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
        telInput.value = formatted;
    });
}

// Enviar Pedido via WhatsApp
document.getElementById("btnEnviar").onclick = async () => {
    const btn = document.getElementById("btnEnviar");
    if (state.carrinho.length === 0) return alert("Seu carrinho está vazio!");

    const nomeCliente = document.getElementById("clienteNome")?.value.trim() || '';
    const telefoneCliente = document.getElementById("clienteTelefone")?.value.trim() || '';

    if (!nomeCliente) return alert("Por favor, informe seu nome completo.");
    if (!telefoneCliente) return alert("Por favor, informe seu telefone/WhatsApp.");

    const mesa = document.getElementById("clienteMesa")?.value.trim() || '';
    const posicao = document.getElementById("clientePosicao")?.value.trim() || '';

    if (!mesa) return alert("Por favor, informe o número da MESA.");
    if (!posicao) return alert("Por favor, informe a POSIÇÃO.");

    const camposEndereco = { mesa, posicao };
    const freteValor = 0;

    btn.disabled = true;
    btn.innerHTML = `<span>Aguarde um momento...</span>`;

    try {
        // Validação de Estoque em Tempo Real
        const productIds = state.carrinho.map(p => p.id);
        const { data: freshStock, error: stockErr } = await sb
            .from('products')
            .select('id, name, stock')
            .in('id', productIds);
            
        if (stockErr) throw stockErr;

        let outOfStockItem = null;
        for (const itemCart of state.carrinho) {
            const dbItem = freshStock.find(p => p.id === itemCart.id);
            if (!dbItem || dbItem.stock < itemCart.qnt) {
                outOfStockItem = dbItem ? dbItem.name : itemCart.nome;
                break;
            }
        }

        if (outOfStockItem) {
            btn.disabled = false;
            btn.innerHTML = `<span>Enviar Pedido via WhatsApp</span><span class="wa-icon">📱</span>`;
            alert(`O produto ${outOfStockItem} é tão delicioso que esgotou (ou não tem a quantidade solicitada) =) \nVeja as outras opções que são tão gostosas quanto ele!`);
            toggleCart(false);
            carregarProdutos(); // Recarrega vitrine para atualizar estoque/esgotados
            return;
        }
        const subtotal = state.carrinho.reduce((acc, p) => acc + (p.preco * p.qnt), 0);
        const desconto = subtotal * state.descontoAtivo;
        const totalFinal = subtotal - desconto + freteValor;

        // 1. Salvar/Atualizar cliente na tabela clientes (upsert por celular)
        (async () => {
            try {
                const celularLimpo = telefoneCliente.replace(/\D/g, '');
                const enderecoStr = `Mesa ${camposEndereco.mesa}, Posição ${camposEndereco.posicao}`;

                const { data: existente } = await sb
                    .from('clientes')
                    .select('id')
                    .eq('celular', celularLimpo)
                    .maybeSingle();

                if (existente) {
                    // Cliente já existe: atualiza nome e localização
                    await sb.from('clientes').update({ 
                        nome: nomeCliente,
                        endereco: enderecoStr 
                    }).eq('id', existente.id);
                } else {
                    // Novo cliente: insere
                    await sb.from('clientes').insert({
                        nome: nomeCliente,
                        celular: celularLimpo,
                        endereco: enderecoStr
                    });
                }
            } catch (e) {
                console.warn('Aviso: não foi possível salvar cliente:', e.message);
            }
        })();

        function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
        const orderId = window.crypto && crypto.randomUUID ? crypto.randomUUID() : generateUUID();

        const orderPayload = {
            id: orderId,
            customer_name: nomeCliente,
            customer_phone: telefoneCliente,
            customer_address: camposEndereco,
            subtotal,
            discount: state.descontoAtivo * 100,
            total: totalFinal,
            status: 'pendente',
            delivery_type: state.tipoEntrega,
            shipping_fee: 0
        };

        // Sem usar .select() ou .single() para não exigir permissão de RLS de SELECT na tabela orders
        const { error: orderError } = await sb.from('orders').insert(orderPayload);
        if (orderError) throw orderError;

        // 3. Salvar Itens do Pedido
        const itemsPayload = state.carrinho.map(p => ({
            order_id: orderId,
            product_id: p.id,
            product_name: p.nome,
            quantity: p.qnt,
            unit_price: p.preco,
            total_price: p.preco * p.qnt,
            observations: p.obs || null
        }));
        const { error: itemsError } = await sb.from('order_items').insert(itemsPayload);
        if (itemsError) throw itemsError;

        // 4. Baixa Automática de Estoque
        // Observação: a lógica do estoque agora roda atomicamente via banco de dados usando um Trigger (Postgres).

        // 4. Montar mensagem WhatsApp
        const fmtW = (v) => formatCurrency(v);
        let msg = `*📦 NOVO PEDIDO — ♠️♦️ACP♥️♣️*%0A%0A`;
        msg += `*👤 Cliente:* ${nomeCliente}%0A`;
        msg += `*📱 Telefone:* ${telefoneCliente}%0A%0A`;

        msg += `*📍 Localização:* Mesa ${mesa}, Posição ${posicao}%0A%0A`;

        msg += `*🛒 Itens:*%0A`;
        state.carrinho.forEach(p => {
            msg += `✅ *${p.qnt}x ${p.nome}* — ${fmtW(p.preco * p.qnt)}%0A`;
            if (p.obs) msg += `_Obs: ${p.obs}_%0A`;
        });
        msg += `%0A`;
        msg += `*💵 Subtotal:* ${fmtW(subtotal)}%0A`;
        if (state.descontoAtivo > 0) {
            msg += `*🎟️ Desconto (${state.cupomAplicado}):* -${fmtW(desconto)}%0A`;
        }
        msg += `*💰 TOTAL: ${fmtW(totalFinal)}*`;

        window.open(`https://wa.me/${CONFIG.telefone}?text=${msg}`);

        // 6. Persistir Nome e Telefone para próxima vez
        localStorage.setItem('acp_nome', nomeCliente);
        localStorage.setItem('acp_telefone', telefoneCliente);

        // 7. Limpar Mesa e Posição
        const mesaInput = document.getElementById("clienteMesa");
        const posicaoInput = document.getElementById("clientePosicao");
        if (mesaInput) mesaInput.value = '';
        if (posicaoInput) posicaoInput.value = '';

        // Limpar carrinho e fechar
        state.carrinho = [];
        state.descontoAtivo = 0;
        state.cupomAplicado = null;
        renderCarrinho();
        toggleCart(false);
        carregarProdutos();
        mostrarConfirmacaoPedido(nomeCliente);

    } catch (err) {
        console.error("Erro ao processar pedido:", err);
        mostrarToast('Houve um problema ao registrar o pedido. Tente novamente!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Enviar Pedido via WhatsApp</span><span class="wa-icon">📱</span>`;
    }
};

// =============================================
// TOAST & CONFIRMAÇÃO
// =============================================

function mostrarToast(msg, tipo = 'success') {
    const existing = document.getElementById('toastMsg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.className = `toast-msg toast-${tipo}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function mostrarConfirmacaoPedido(nome) {
    const overlay = document.createElement('div');
    overlay.id = 'orderConfirmOverlay';
    overlay.innerHTML = `
        <div class="order-confirm-box">
            <div class="order-confirm-emoji">🍽️</div>
            <h2 class="order-confirm-title">Pedido Enviado!</h2>
            <p class="order-confirm-sub">Ebaaa, ${nome}! Seu pedido foi registrado com sucesso 🎉</p>
            <p class="order-confirm-detail">Em breve você receberá uma confirmação pelo WhatsApp. <br>Prepara o prato porque vem coisa boa aí! 😋</p>
            <button class="order-confirm-btn" onclick="document.getElementById('orderConfirmOverlay').remove()">Maravilha! 🤩</button>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('order-confirm-visible'));
}

// UI Controls
const toggleCart = (show) => {
    dom.cart.classList.toggle('open', show);
    dom.backdrop.classList.toggle('active', show);
    dom.cart.setAttribute('aria-hidden', String(!show));
    if (show) navegarStep(1); // Sempre abre na etapa 1
};

document.getElementById("btnCart").onclick = () => toggleCart(true);
document.getElementById("closeCart").onclick = () => toggleCart(false);
document.getElementById("closeModal").onclick = () => toggleModal(false);
dom.backdrop.onclick = () => { toggleCart(false); toggleModal(false); };

// =============================================
// INICIALIZAR
// =============================================
inicializar();