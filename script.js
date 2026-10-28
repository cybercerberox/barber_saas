// ==========================================================================
// APLICAÇÃO PÚBLICA DE AGENDAMENTO (MULTI-TENANT) - script.js
// ==========================================================================

let barbeariaAtualId = null;
let barbeariaAtualNome = null;
let servicosDisponiveis = [];

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    await carregarBarbearia();
    initLiveStatus();
    initMobileMenu();
    initMinDate();
    initPhoneMask();
    setCurrentYear();
});

// 1. CARREGAR BARBEARIA VIA SLUG NA URL (Multi-Tenant)
async function carregarBarbearia() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('salao');

    const warningBanner = document.getElementById('tenantWarning');
    const warningText = document.getElementById('tenantWarningText');
    const btnSubmit = document.getElementById('btnSubmitAppointment');

    if (!slug) {
        console.warn('Aviso: Nenhuma barbearia especificada na URL (?salao=slug).');
        if (warningBanner && warningText) {
            warningText.innerHTML = '<strong>Atenção:</strong> Nenhuma barbearia foi especificada na URL. Para agendar, acesse com o link do salão (ex: <code>index.html?salao=vintage</code>) ou <a href="landing_comercial.html">conheça o sistema para seu salão</a>.';
            warningBanner.style.display = 'block';
        }
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.title = 'Acesse com um salão especificado na URL para agendar.';
        }
        renderizarServicosVazios('Informe um salão na URL para carregar os serviços disponíveis.');
        return;
    }

    try {
        if (!supabaseClient) {
            throw new Error('Supabase Client não inicializado. Verifique supabase-config.js');
        }

        const { data, error } = await supabaseClient
            .from('barbearias')
            .select('id, nome_salao, slug')
            .eq('slug', slug.trim())
            .single();

        if (error || !data) {
            console.error('Barbearia não encontrada para o slug:', slug, error);
            if (warningBanner && warningText) {
                warningText.innerHTML = `<strong>Atenção:</strong> O salão <code>${slug}</code> não foi encontrado. Verifique o link digitado.`;
                warningBanner.style.display = 'block';
            }
            if (btnSubmit) {
                btnSubmit.disabled = true;
            }
            renderizarServicosVazios('Barbearia não encontrada.');
            return;
        }

        // Barbearia localizada com sucesso!
        barbeariaAtualId = data.id;
        barbeariaAtualNome = data.nome_salao;

        // Atualiza elementos visuais da página dinamicamente com o nome do salão
        document.title = `${data.nome_salao} - Agendamento Online`;

        const brandName = document.getElementById('brandName');
        if (brandName) brandName.textContent = data.nome_salao;

        const footerBrandName = document.getElementById('footerBrandName');
        if (footerBrandName) footerBrandName.textContent = data.nome_salao;

        const copyrightBrand = document.getElementById('copyrightBrand');
        if (copyrightBrand) copyrightBrand.textContent = data.nome_salao;

        const heroSubtitle = document.getElementById('heroSubtitle');
        if (heroSubtitle) heroSubtitle.textContent = `BEM-VINDO À ${data.nome_salao.toUpperCase()}`;

        if (warningBanner) {
            warningBanner.style.display = 'none';
        }
        if (btnSubmit) {
            btnSubmit.disabled = false;
        }

        // Carrega os serviços cadastrados especificamente para esta barbearia
        await carregarServicosBarbearia(barbeariaAtualId);

    } catch (err) {
        console.error('Erro ao conectar ao Supabase:', err);
    }
}

// 2. CARREGAR SERVIÇOS EXCLUSIVOS DA BARBEARIA DO BANCO
async function carregarServicosBarbearia(barbeariaId) {
    const gridContainer = document.getElementById('servicesGrid');
    const selectServico = document.getElementById('servico');

    try {
        const { data: servicos, error } = await supabaseClient
            .from('servicos')
            .select('*')
            .eq('barbearia_id', barbeariaId)
            .order('id', { ascending: true });

        if (error) throw error;

        servicosDisponiveis = servicos || [];

        if (servicosDisponiveis.length === 0) {
            renderizarServicosVazios('Esta barbearia ainda não cadastrou seus serviços.');
            if (selectServico) {
                selectServico.innerHTML = '<option value="">Nenhum serviço disponível no momento</option>';
            }
            return;
        }

        // Renderiza cards de serviços na grade visual
        gridContainer.innerHTML = servicosDisponiveis.map(servico => {
            const precoFormatado = Number(servico.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const descricao = servico.descricao || 'Atendimento com produtos de primeira linha e profissionais especializados.';
            const rotuloCompleto = `${servico.nome} - ${precoFormatado}`;

            return `
                <div class="service-card">
                    <div class="service-icon"><i class="fas fa-scissors"></i></div>
                    <h3>${escapeHtml(servico.nome)}</h3>
                    <p>${escapeHtml(descricao)}</p>
                    <div class="service-price">${precoFormatado}</div>
                    <button type="button" class="btn-select-service" onclick="selecionarServico('${escapeHtml(rotuloCompleto)}')">
                        <i class="far fa-calendar-plus"></i> Agendar Este
                    </button>
                </div>
            `;
        }).join('');

        // Popula o dropdown <select> do formulário
        if (selectServico) {
            selectServico.innerHTML = '<option value="">Selecione um serviço...</option>' + 
                servicosDisponiveis.map(s => {
                    const preco = Number(s.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const val = `${s.nome} - ${preco}`;
                    return `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`;
                }).join('');
        }

    } catch (err) {
        console.error('Erro ao carregar serviços:', err);
        renderizarServicosVazios('Erro ao carregar lista de serviços.');
    }
}

function renderizarServicosVazios(mensagem) {
    const gridContainer = document.getElementById('servicesGrid');
    if (gridContainer) {
        gridContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-store-slash"></i>
                <h3>Serviços Indisponíveis</h3>
                <p>${mensagem}</p>
            </div>
        `;
    }
}

// 3. MÁSCARA INTELIGENTE DE TELEFONE
function initPhoneMask() {
    const phoneInput = document.getElementById('telefone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 6) {
            value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
        } else if (value.length > 2) {
            value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        } else if (value.length > 0) {
            value = `(${value}`;
        }

        e.target.value = value;
    });
}

// 4. STATUS DA LOJA EM TEMPO REAL (Aberto / Fechado)
function initLiveStatus() {
    const statusContainer = document.getElementById('live-status');
    const statusText = document.getElementById('status-text');

    if (!statusContainer || !statusText) return;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentHour = now.getHours();

    const isOpenDay = dayOfWeek >= 1 && dayOfWeek <= 6;
    const isOpenHour = currentHour >= 9 && currentHour < 20;

    if (isOpenDay && isOpenHour) {
        statusContainer.className = 'status-badge open';
        statusText.textContent = 'Aberto Agora';
    } else {
        statusContainer.className = 'status-badge closed';
        statusText.textContent = 'Fechado Agora';
    }
}

// 5. MENU MOBILE HAMBÚRGUER
function initMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });
    }
}

// 6. SELEÇÃO RÁPIDA DE SERVIÇO NA GRID
function selecionarServico(nomeServico) {
    const selectServico = document.getElementById('servico');
    if (!selectServico) return;

    for (let i = 0; i < selectServico.options.length; i++) {
        if (selectServico.options[i].value === nomeServico || selectServico.options[i].text.includes(nomeServico)) {
            selectServico.selectedIndex = i;
            break;
        }
    }

    const agendamentoSection = document.getElementById('agendamento');
    if (agendamentoSection) {
        agendamentoSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// 7. IMPEDIR SELEÇÃO DE DATAS PASSADAS
function initMinDate() {
    const dateInput = document.getElementById('data');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }
}

// 8. ANO DO COPYRIGHT
function setCurrentYear() {
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

// 9. PROCESSAR AGENDAMENTO (INSERT NO SUPABASE)
async function processarAgendamento(e) {
    e.preventDefault();

    const formAlert = document.getElementById('formAlert');
    if (formAlert) formAlert.style.display = 'none';

    if (!barbeariaAtualId) {
        mostrarAlertaForm('Não é possível agendar: nenhuma barbearia foi identificada na URL (ex: ?salao=vintage).', 'danger');
        return;
    }

    const nome = document.getElementById('nome').value.trim();
    const telefone = document.getElementById('telefone').value.trim();
    const servico = document.getElementById('servico').value;
    const dataRaw = document.getElementById('data').value;
    const hora = document.getElementById('hora').value;

    if (!nome || !telefone || !servico || !dataRaw || !hora) {
        mostrarAlertaForm('Por favor, preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitAppointment');
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirmando agendamento...';
    btnSubmit.disabled = true;

    try {
        const { data, error } = await supabaseClient
            .from('agendamentos')
            .insert([
                {
                    barbearia_id: barbeariaAtualId,
                    nome_cliente: nome,
                    telefone: telefone,
                    servico: servico,
                    data_agendamento: dataRaw,
                    hora: hora,
                    status: 'pendente'
                }
            ])
            .select();

        if (error) throw error;

        const partesData = dataRaw.split('-');
        const dataFormatada = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;

        const summaryBox = document.getElementById('modalSummary');
        summaryBox.innerHTML = `
            <p><strong>Salão:</strong> ${escapeHtml(barbeariaAtualNome || 'Barbearia')}</p>
            <p><strong>Cliente:</strong> ${escapeHtml(nome)}</p>
            <p><strong>Telefone:</strong> ${escapeHtml(telefone)}</p>
            <p><strong>Serviço:</strong> ${escapeHtml(servico)}</p>
            <p><strong>Data:</strong> ${dataFormatada}</p>
            <p><strong>Horário:</strong> ${hora}</p>
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color); color: var(--success); text-align: center; font-weight: 600;">
                <i class="fas fa-check-circle"></i> Agendamento gravado com sucesso!
            </div>
        `;

        document.getElementById('bookingModal').classList.add('active');

    } catch (err) {
        console.error('Erro ao agendar no Supabase:', err);
        mostrarAlertaForm('Ocorreu um erro ao registrar seu agendamento no servidor. Por favor, tente novamente.', 'danger');
    } finally {
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
    }
}

// 10. FUNÇÕES DE SUPORTE AO MODAL E ALERTAS
function fecharModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) modal.classList.remove('active');
}

function fecharModalLimparForm() {
    fecharModal();
    const form = document.getElementById('appointmentForm');
    if (form) form.reset();
}

window.addEventListener('click', (e) => {
    const modal = document.getElementById('bookingModal');
    if (e.target === modal) {
        fecharModal();
    }
});

function mostrarAlertaForm(mensagem, tipo = 'info') {
    const alertBox = document.getElementById('formAlert');
    if (!alertBox) {
        alert(mensagem);
        return;
    }
    alertBox.className = `alert alert-${tipo}`;
    alertBox.innerHTML = `<i class="fas fa-info-circle"></i> <span>${mensagem}</span>`;
    alertBox.style.display = 'flex';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
