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
    tipoEntrega: 'mesa',   // 'mesa' | 'retirada' | 'entrega'
    formaPagamento: 'dinheiro', // 'pix', 'dinheiro', 'cartao'
    freteAtivo: 0,         // valor em R$ do frete calculado
    freteHabilitado: false // controlado pelo Admin via store_settings
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
        vincularRadiosEntrega();
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
        img: p.image_url || 'logo_automovel.png',
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
        aplicarPersonalizacaoVisual(CONFIG_LOJA);

        // Atualizar estado de frete
        state.freteHabilitado = !!CONFIG_LOJA.frete_ativo;
        if (state.freteHabilitado) {
            state.tipoEntrega = 'retirada'; // padrão quando frete habilitado
        }
    }

    if (!zonesRes.error) {
        // Ordenar por nome para facilitar visualização
        ZONAS_FRETE = (zonesRes.data || []).sort((a, b) => a.name.localeCompare(b.name));
    }
}

function aplicarPersonalizacaoVisual(config) {
    if (!config) return;

    // Textos
    if (config.brand_name) {
        const el = document.querySelector('.brand-name');
        if (el) el.textContent = config.brand_name;
        document.title = config.brand_name + ' | Cardápio Digital';
    }
    if (config.brand_subtitle) {
        const el = document.querySelector('.brand-subtitle');
        if (el) el.textContent = config.brand_subtitle;
    }

    // Banner
    if (config.banner_url) {
        const el = document.querySelector('.banner-desktop');
        if (el) el.style.backgroundImage = `url(${config.banner_url})`;
    }

    // Logo
    if (config.logo_url) {
        const el = document.querySelector('.logo-main');
        if (el) el.style.backgroundImage = `url(${config.logo_url})`;
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
        if (dom.total) dom.total.innerText = "0,00";
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
// WIZARD ETAPAS DO CHECKOUT
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

        const tipoAtual = state.freteHabilitado ? state.tipoEntrega : 'mesa';
        toggleTipoEntrega(tipoAtual);

        if (state.freteHabilitado) {
            const optR = document.getElementById('optRetirada');
            const optE = document.getElementById('optEntrega');
            if (optR) optR.onchange = () => toggleTipoEntrega('retirada');
            if (optE) optE.onchange = () => toggleTipoEntrega('entrega');
            if (optR && state.tipoEntrega !== 'entrega') optR.checked = true;
            if (optE && state.tipoEntrega === 'entrega') optE.checked = true;
        }

        const btnBuscarCep = document.getElementById('btnBuscarCep');
        if (btnBuscarCep) btnBuscarCep.onclick = buscarCepAuto;
        const cepEl = document.getElementById('cep');
        if (cepEl) cepEl.oninput = onCepInput;
    }
}

// =============================================
// FRETE
// =============================================

function normalizar(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function calcularFrete(bairro) {
    if (!state.freteHabilitado) return 0;
    if (!bairro) return -1;

    const normalizarInterno = (s) => (s || '').toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const bairroClienteNorm = normalizarInterno(bairro);

    const zona = ZONAS_FRETE.find(z => {
        if (!z.neighborhoods) return false;
        const listaBairros = z.neighborhoods.split(',').map(b => normalizarInterno(b));
        return listaBairros.includes(bairroClienteNorm);
    });
    
    if (zona) {
        return parseFloat(zona.fee) || 0;
    }
    return -1;
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
    if (!els.sub) return;

    els.sub.textContent = fmt(subtotal);

    if (desconto > 0) {
        els.desc.textContent = `- ${fmt(desconto)}`;
        els.desc.style.color = '#00B894';
        els.descRow.style.display = 'flex';
    } else {
        els.descRow.style.display = 'none';
    }

    const frete = state.freteHabilitado && state.tipoEntrega === 'entrega' ? state.freteAtivo : 0;
    if (els.freteRow) {
        if (frete > 0) {
            els.frete.textContent = fmt(frete);
            els.frete.style.color = 'inherit';
            els.freteRow.style.display = 'flex';
        } else if (state.freteHabilitado && state.tipoEntrega === 'entrega' && frete === -1) {
            els.frete.textContent = '⚠️ Bairro não atendido';
            els.frete.style.color = 'var(--danger)';
            els.freteRow.style.display = 'flex';
        } else if (state.freteHabilitado && state.tipoEntrega === 'entrega') {
            els.frete.textContent = 'Informe o CEP';
            els.frete.style.color = 'var(--text-muted)';
            els.freteRow.style.display = 'flex';
        } else {
            els.freteRow.style.display = 'none';
        }
    }

    const totalFinal = subtotal - desconto + (frete > 0 ? frete : 0);
    els.tot.textContent = fmt(totalFinal);
}

// =============================================
// CEP AUTOCOMPLETE
// =============================================

let _cepTimer = null;

function onCepInput(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
    e.target.value = v;

    clearTimeout(_cepTimer);
    const digitosLimpos = v.replace(/\D/g, '');
    if (digitosLimpos.length === 8) {
        _cepTimer = setTimeout(buscarCepAuto, 600);
    } else {
        const status = document.getElementById('cepStatus');
        if (status) { status.textContent = ''; status.style.color = ''; }
        state.freteAtivo = 0;
        renderTotalBreakdown();
    }
}

async function buscarCepAuto() {
    const cepInput = document.getElementById('cep');
    if (!cepInput) return;
    const cepLimpo = cepInput.value.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    const status = document.getElementById('cepStatus');
    const loading = document.getElementById('cepLoading');
    const camposExtras = document.getElementById('camposEnderecoAuto');

    if (status) status.textContent = '';
    if (loading) loading.style.display = 'block';

    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();

        if (data.erro) {
            if (status) { status.textContent = '❌ CEP não encontrado.'; status.style.color = 'var(--danger)'; }
            if (camposExtras) camposExtras.style.display = 'none';
            state.freteAtivo = 0;
            renderTotalBreakdown();
            return;
        }

        const logEl = document.getElementById('endLogradouro');
        const baiEl = document.getElementById('endBairro');
        if (logEl) logEl.value = data.logradouro || '';
        if (baiEl) baiEl.value = data.bairro || '';
        if (camposExtras) camposExtras.style.display = 'block';

        const frete = calcularFrete(data.bairro);
        state.freteAtivo = frete;

        if (frete === -1) {
            if (status) { status.textContent = '⚠️ Bairro não atendido para entrega.'; status.style.color = 'var(--danger)'; }
        } else {
            if (status) { 
                status.textContent = `✅ Frete para ${data.bairro}: ${frete === 0 ? 'Grátis' : formatCurrency(frete)}`; 
                status.style.color = 'var(--success)'; 
            }
        }

        renderTotalBreakdown();
    } catch {
        if (status) { status.textContent = '❌ Erro ao buscar CEP.'; status.style.color = 'var(--danger)'; }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

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

document.getElementById("mais").onclick = () => {
    const maxQty = state.produtoSelecionado?.stock || 0;
    if (state.quantidadeAtual < maxQty) {
        state.quantidadeAtual++;
        dom.qntText.innerText = state.quantidadeAtual;
        atualizarSubtotalModal();
    } else {
        mostrarToast("Quantidade máxima em estoque atingida!", "error");
    }
};

document.getElementById("menos").onclick = () => {
    if (state.quantidadeAtual > 1) {
        state.quantidadeAtual--;
        dom.qntText.innerText = state.quantidadeAtual;
        atualizarSubtotalModal();
    }
};

document.getElementById("confirmar").onclick = () => {
    const obs = document.getElementById("obs").value;
    state.carrinho.push({ ...state.produtoSelecionado, qnt: state.quantidadeAtual, obs });
    renderCarrinho();
    document.getElementById("confirmar").style.display = "none";
    document.getElementById("postAddActions").style.display = "flex";
};

document.getElementById("btnContinuar").onclick = () => toggleModal(false);
document.getElementById("btnIrCarrinho").onclick = () => { toggleModal(false); toggleCart(true); };

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

dom.busca.onkeyup = (e) => {
    state.termoBusca = e.target.value;
    renderMenu();
};

function toggleTipoEntrega(tipo) {
    state.tipoEntrega = tipo;
    const secaoEndereco = document.getElementById('secaoEndereco');
    const secaoMesa = document.getElementById('secaoMesa');
    const secaoTipo = document.getElementById('secaoTipoRecebimento');

    if (!state.freteHabilitado) {
        if (secaoEndereco) secaoEndereco.style.display = 'none';
        if (secaoMesa) secaoMesa.style.display = '';
        if (secaoTipo) secaoTipo.style.display = 'none';
        state.tipoEntrega = 'mesa';
        state.freteAtivo = 0;
        renderTotalBreakdown();
        return;
    }

    if (secaoTipo) secaoTipo.style.display = '';

    if (tipo === 'entrega') {
        if (secaoEndereco) secaoEndereco.style.display = '';
        if (secaoMesa) secaoMesa.style.display = 'none';
    } else {
        if (secaoEndereco) secaoEndereco.style.display = 'none';
        if (tipo === 'mesa' && !state.freteHabilitado) {
            if (secaoMesa) secaoMesa.style.display = '';
        } else {
            if (secaoMesa) secaoMesa.style.display = 'none';
        }
        state.freteAtivo = 0;
        renderTotalBreakdown();
    }
}

function vincularRadiosEntrega() {
    document.querySelectorAll('input[name="tipoEntrega"]').forEach(radio => {
        radio.addEventListener('change', (e) => toggleTipoEntrega(e.target.value));
    });
}

document.getElementById("btnProximaEtapa").onclick = () => {
    if (state.carrinho.length === 0) return;
    navegarStep(2);
};

document.getElementById("btnVoltarEtapa").onclick = () => navegarStep(1);

const telInput = document.getElementById('clienteTelefone');
if (telInput) {
    telInput.addEventListener('input', () => {
        let digits = telInput.value.replace(/\D/g, '').slice(0, 11);
        let formatted = digits;
        if (digits.length > 2)  formatted = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
        if (digits.length > 7)  formatted = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
        telInput.value = formatted;
    });
}

// Enviar Pedido
document.getElementById("btnEnviar").onclick = async () => {
    const btn = document.getElementById("btnEnviar");
    if (state.carrinho.length === 0) return mostrarToast("Seu carrinho está vazio!", "error");

    const formaPagamentoEl = document.querySelector('input[name="formaPagamento"]:checked');
    const formaPagamento = formaPagamentoEl ? formaPagamentoEl.value : 'dinheiro';
    state.formaPagamento = formaPagamento;

    const nomeCliente    = document.getElementById("clienteNome")?.value.trim() || '';
    const telefoneCliente = document.getElementById("clienteTelefone")?.value.trim() || '';

    if (!nomeCliente)    return mostrarToast("Por favor, informe seu nome completo.", "error");
    if (!telefoneCliente) return mostrarToast("Por favor, informe seu telefone/WhatsApp.", "error");

    let camposEndereco = {};
    let freteValor = 0;

    if (!state.freteHabilitado || state.tipoEntrega === 'mesa') {
        const mesa    = document.getElementById("clienteMesa")?.value.trim() || '';
        const posicao = document.getElementById("clientePosicao")?.value.trim() || '';
        if (!mesa)    return mostrarToast("Por favor, informe o número da MESA.", "error");
        if (!posicao) return mostrarToast("Por favor, informe a POSIÇÃO.", "error");
        camposEndereco = { mesa, posicao };
        freteValor = 0;
    } else if (state.tipoEntrega === 'entrega') {
        const cep         = document.getElementById("cep")?.value.trim() || '';
        const numero      = document.getElementById("endNumero")?.value.trim() || '';
        const logradouro  = document.getElementById("endLogradouro")?.value.trim() || '';
        const bairro      = document.getElementById("endBairro")?.value.trim() || '';
        const complemento = document.getElementById("endComplemento")?.value.trim() || '';

        if (!cep) return mostrarToast("Por favor, informe o CEP para entrega.", "error");
        if (!numero) return mostrarToast("Por favor, informe o número do endereço.", "error");
        if (state.freteAtivo === -1) return mostrarToast("⚠️ Este endereço não é atendido para entrega.", "error");

        camposEndereco = { cep, logradouro, numero, bairro, complemento };
        freteValor = state.freteAtivo > 0 ? state.freteAtivo : 0;
    } else if (state.tipoEntrega === 'retirada') {
        camposEndereco = { retirada: true };
        freteValor = 0;
    }

    btn.disabled = true;
    btn.innerHTML = `<span>Processando pedido...</span>`;

    try {
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
            btn.innerHTML = `<span>Enviar pedido para o atendente</span><span class="atendente-icon">🛎️</span>`;
            mostrarToast(`Produto esgotado ou quantidade indisponível!`, 'error');
            toggleCart(false);
            carregarProdutos();
            return;
        }

        const subtotal = state.carrinho.reduce((acc, p) => acc + (p.preco * p.qnt), 0);
        const desconto = subtotal * state.descontoAtivo;
        const totalFinal = subtotal - desconto + freteValor;

        const celularLimpo = telefoneCliente.replace(/\D/g, '');
        const enderecoStr = state.freteHabilitado
            ? (state.tipoEntrega === 'entrega'
                ? `${camposEndereco.logradouro || ''}, ${camposEndereco.numero || ''} - ${camposEndereco.bairro || ''} (CEP: ${camposEndereco.cep || ''})`
                : state.tipoEntrega === 'retirada' ? 'Retirada no local' : `Mesa ${camposEndereco.mesa || ''}, Posição ${camposEndereco.posicao || ''}`)
            : `Mesa ${camposEndereco.mesa || ''}, Posição ${camposEndereco.posicao || ''}`;

        // Salvar dados do cliente em segundo plano (não trava o processo principal)
        sb.from('clientes').upsert({
            celular: celularLimpo,
            nome: nomeCliente,
            endereco: enderecoStr
        }, { onConflict: 'celular' });


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
            payment_method: state.formaPagamento,
            payment_status: 'pendente',
            delivery_type: state.tipoEntrega,
            shipping_fee: freteValor
        };

        const { error: orderError } = await sb.from('orders').insert(orderPayload);
        if (orderError) throw orderError;

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

        const fmtW = (v) => formatCurrency(v);
        let msg = `*📦 NOVO PEDIDO — ♠️♦️ACP♥️♣️*%0A%0A`;
        msg += `*👤 Cliente:* ${nomeCliente}%0A`;
        msg += `*📱 Telefone:* ${telefoneCliente}%0A%0A`;

        msg += `*📍 Localização:*`;
        if (!state.freteHabilitado || state.tipoEntrega === 'mesa') {
            msg += ` Mesa ${camposEndereco.mesa || '—'}, Posição ${camposEndereco.posicao || '—'}%0A%0A`;
        } else if (state.tipoEntrega === 'entrega') {
            msg += ` Entrega%0A`;
            msg += `${camposEndereco.logradouro || ''}, ${camposEndereco.numero || ''}`;
            if (camposEndereco.complemento) msg += ` - ${camposEndereco.complemento}`;
            msg += `%0A${camposEndereco.bairro || ''} - CEP: ${camposEndereco.cep || ''}%0A%0A`;
        } else {
            msg += ` Retirada no local%0A%0A`;
        }

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
        if (freteValor > 0) {
            msg += `*📦 Frete:* ${fmtW(freteValor)}%0A`;
        }
        msg += `*💰 TOTAL: ${fmtW(totalFinal)}*`;

        localStorage.setItem('acp_nome', nomeCliente);
        localStorage.setItem('acp_telefone', telefoneCliente);

        const mesaInput = document.getElementById("clienteMesa");
        const posicaoInput = document.getElementById("clientePosicao");
        if (mesaInput) mesaInput.value = '';
        if (posicaoInput) posicaoInput.value = '';

        state.carrinho = [];
        state.descontoAtivo = 0;
        state.cupomAplicado = null;
        renderCarrinho();
        toggleCart(false);
        carregarProdutos();
        
        if (state.formaPagamento === 'pix') {
            await iniciarFluxoPix(orderId, totalFinal, msg);
        } else {
            window.open(`https://wa.me/${CONFIG.telefone}?text=${msg}`);
            mostrarConfirmacaoPedido(nomeCliente);
        }

    } catch (err) {
        console.error("Erro ao processar pedido:", err);
        mostrarToast('Houve um problema ao registrar o pedido. Tente novamente!', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Enviar pedido para o atendente</span><span class="atendente-icon">🛎️</span>`;
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
    if (show) navegarStep(1);
};

document.getElementById("btnCart").onclick = () => toggleCart(true);
document.getElementById("closeCart").onclick = () => toggleCart(false);
document.getElementById("closeModal").onclick = () => toggleModal(false);
dom.backdrop.onclick = () => { toggleCart(false); toggleModal(false); };

// =============================================
// FLUXO PIX MERCADO PAGO
// =============================================

async function iniciarFluxoPix(orderId, total, whatsappMsg) {
    const modal = document.getElementById('modalPix');
    const qrImage = document.getElementById('pixQrImage');
    const loading = document.getElementById('pixLoading');
    const statusMsg = document.getElementById('pixStatusMessage');
    const btnCopiar = document.getElementById('btnCopiarPix');

    modal.classList.add('active');
    loading.style.display = 'block';
    qrImage.style.display = 'none';
    statusMsg.innerText = 'Gerando seu PIX...';
    statusMsg.style.color = 'var(--primary)';
    btnCopiar.disabled = true;

    try {
        // Resetar modal para estado inicial
        pixLoading.style.display = 'block';
        qrImage.style.display = 'none';
        btnCopiar.style.display = 'none';
        statusMsg.innerText = 'Gerando cobrança...';

        const { data, error } = await sb.functions.invoke('mercadopago-pix', {
            body: { orderId }
        });

        if (error || (data && data.error)) {
            const msgErro = error?.details || data?.error || 'Erro desconhecido';
            mostrarToast('Erro do Mercado Pago: ' + msgErro, 'error');
            throw new Error(msgErro);
        }

        loading.style.display = 'none';
        pixLoading.style.display = 'none';
        qrImage.src = `data:image/png;base64,${data.qr_code_base64}`;
        qrImage.style.display = 'block';
        btnCopiar.style.display = 'block'; // Mostrar botão apenas agora
        statusMsg.innerText = 'Aguardando pagamento...';
        btnCopiar.disabled = false;

        btnCopiar.onclick = () => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(data.qr_code);
                const feedback = document.getElementById('copyPixFeedback');
                feedback.style.display = 'block';
                setTimeout(() => feedback.style.display = 'none', 3000);
            } else {
                mostrarToast('Seu navegador não suporta cópia automática.', 'warn');
            }
        };

        const channel = sb.channel(`order-pix-${orderId}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'orders', 
                filter: `id=eq.${orderId}` 
            }, payload => {
                if (payload.new.payment_status === 'pago') {
                    statusMsg.innerHTML = '✅ PAGAMENTO CONFIRMADO!';
                    statusMsg.style.color = '#25D366';
                    
                    setTimeout(() => {
                        modal.classList.remove('active');
                        mostrarToast('Pagamento recebido!', 'success');
                        window.open(`https://wa.me/${CONFIG.telefone}?text=${whatsappMsg}%0A%0A*✅ PAGAMENTO PIX CONFIRMADO*`);
                        setTimeout(() => window.location.reload(), 2000);
                    }, 2000);
                    
                    sb.removeChannel(channel);
                }
            })
            .subscribe();

        document.getElementById('closeModalPix').onclick = () => {
            modal.classList.remove('active');
            sb.removeChannel(channel);
        };

    } catch (err) {
        console.error('Erro no fluxo PIX:', err);
        mostrarToast('Erro ao gerar PIX.', 'error');
        modal.classList.remove('active');
        const btn = document.getElementById('btnEnviar');
        btn.disabled = false;
        btn.innerHTML = `<span>Tentar novamente</span>`;
    }
}

// Inicializar
inicializar();
