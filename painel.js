// ==========================================================================
// PAINEL ADMINISTRATIVO SAAS (MULTI-TENANT) - painel.js
// Gestão de Agendamentos & Catálogo de Serviços do Barbeiro
// ==========================================================================

let usuarioAtual = null;
let barbeariaAtual = null;
let todosAgendamentos = [];
let todosServicos = [];
let filtroStatusAtual = 'todos';
let filtroDataAtual = '';

document.addEventListener('DOMContentLoaded', carregarPainelSaaS);

// 1. CARREGAR DADOS DO USUÁRIO E DA BARBEARIA
async function carregarPainelSaaS() {
    try {
        if (!supabaseClient) {
            throw new Error('Supabase Client não inicializado. Verifique supabase-config.js');
        }

        // 1.1 Valida se o usuário está logado
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            console.warn('Usuário não autenticado. Redirecionando para login...');
            window.location.href = 'login.html';
            return;
        }

        usuarioAtual = user;

        // Exibe e-mail na topbar
        const userEmailSpan = document.getElementById('userEmailSpan');
        if (userEmailSpan) {
            userEmailSpan.textContent = user.email;
        }

        // 1.2 Busca a barbearia vinculada ao usuário logado (owner_id)
        const { data: barbearia, error: barbError } = await supabaseClient
            .from('barbearias')
            .select('*')
            .eq('owner_id', user.id)
            .single();

        if (barbError || !barbearia) {
            console.error('Nenhuma barbearia encontrada para este usuário:', barbError);
            const container = document.getElementById('listaAgendamentos');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-store-slash"></i>
                    <h3>Nenhuma barbearia cadastrada nesta conta</h3>
                    <p style="margin-bottom: 20px;">Para começar a receber agendamentos, você precisa cadastrar o seu salão.</p>
                    <a href="cadastro_barbearia.html" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Cadastrar Salão Agora
                    </a>
                </div>
            `;
            return;
        }

        barbeariaAtual = barbearia;

        // Atualiza a interface com as informações do salão
        document.getElementById('barbeariaNomeTop').textContent = barbearia.nome_salao;
        document.getElementById('barbeariaTitle').textContent = `Agendamentos - ${barbearia.nome_salao}`;
        
        // Configura link da página pública do salão
        const linkPublico = document.getElementById('linkPaginaPublica');
        if (linkPublico) {
            linkPublico.href = `index.html?salao=${encodeURIComponent(barbearia.slug)}`;
            linkPublico.style.display = 'inline-flex';
        }

        // 1.3 Carrega os agendamentos e os serviços
        await buscarAgendamentos();
        await buscarServicos();

    } catch (err) {
        console.error('Erro crítico no painel administrativo:', err);
        mostrarAlertaPainel('Ocorreu um erro ao carregar as informações do painel.', 'danger');
    }
}

// 2. ALTERNAR ENTRE ABAS DO PAINEL (AGENDAMENTOS vs SERVIÇOS)
function alternarAba(aba) {
    const secaoAgendamentos = document.getElementById('secaoAgendamentos');
    const secaoServicos = document.getElementById('secaoServicos');
    const tabBtnAgendamentos = document.getElementById('tabBtnAgendamentos');
    const tabBtnServicos = document.getElementById('tabBtnServicos');

    if (aba === 'agendamentos') {
        secaoAgendamentos.style.display = 'block';
        secaoServicos.style.display = 'none';
        tabBtnAgendamentos.classList.add('active');
        tabBtnServicos.classList.remove('active');
    } else {
        secaoAgendamentos.style.display = 'none';
        secaoServicos.style.display = 'block';
        tabBtnAgendamentos.classList.remove('active');
        tabBtnServicos.classList.add('active');
    }
}

// ==========================================================================
// MÓDULO: GESTÃO DE AGENDAMENTOS
// ==========================================================================

async function buscarAgendamentos() {
    if (!barbeariaAtual) return;

    try {
        const { data: agendamentos, error } = await supabaseClient
            .from('agendamentos')
            .select('*')
            .eq('barbearia_id', barbeariaAtual.id)
            .order('data_agendamento', { ascending: true })
            .order('hora', { ascending: true });

        if (error) throw error;

        todosAgendamentos = agendamentos || [];
        atualizarMetricas(todosAgendamentos);
        renderizarAgendamentos();

    } catch (err) {
        console.error('Erro ao buscar agendamentos:', err);
        mostrarAlertaPainel('Erro ao carregar a lista de agendamentos.', 'danger');
    }
}

function atualizarMetricas(lista) {
    const total = lista.length;
    const pendentes = lista.filter(a => a.status === 'pendente').length;
    const concluidos = lista.filter(a => a.status === 'concluido').length;
    const cancelados = lista.filter(a => a.status === 'cancelado').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPendentes').textContent = pendentes;
    document.getElementById('statConcluidos').textContent = concluidos;
    document.getElementById('statCancelados').textContent = cancelados;
}

function renderizarAgendamentos() {
    const container = document.getElementById('listaAgendamentos');

    let filtrados = todosAgendamentos.filter(agendamento => {
        const atendeStatus = (filtroStatusAtual === 'todos') || (agendamento.status === filtroStatusAtual);
        const atendeData = (!filtroDataAtual) || (agendamento.data_agendamento === filtroDataAtual);
        return atendeStatus && atendeData;
    });

    if (filtrados.length === 0) {
        let mensagemFiltro = 'Nenhum agendamento encontrado para os filtros selecionados.';
        if (todosAgendamentos.length === 0) {
            mensagemFiltro = 'Você ainda não recebeu nenhum agendamento. Compartilhe o link da sua página pública com seus clientes!';
        }

        container.innerHTML = `
            <div class="empty-state">
                <i class="far fa-calendar-times"></i>
                <h3>Nenhum agendamento por aqui</h3>
                <p style="margin-bottom: 20px;">${mensagemFiltro}</p>
                <a href="index.html?salao=${encodeURIComponent(barbeariaAtual.slug)}" target="_blank" class="btn btn-outline-gold btn-sm">
                    <i class="fas fa-external-link-alt"></i> Acessar Link do Salão
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = filtrados.map(agendamento => {
        const partesData = (agendamento.data_agendamento || '').split('-');
        const dataFormatada = partesData.length === 3 ? `${partesData[2]}/${partesData[1]}/${partesData[0]}` : agendamento.data_agendamento;

        const telLimpo = (agendamento.telefone || '').replace(/\D/g, '');
        const linkWhats = telLimpo.length >= 10 ? `https://wa.me/55${telLimpo}` : null;

        const nomeCliente = escapeHtml(agendamento.nome_cliente || agendamento.nome || 'Cliente');
        const servico = escapeHtml(agendamento.servico || 'Não especificado');
        const hora = escapeHtml(agendamento.hora || '--:--');
        const status = agendamento.status || 'pendente';

        return `
            <div class="appointment-card" id="card-${agendamento.id}">
                <div>
                    <div class="appointment-header">
                        <h3>${nomeCliente}</h3>
                        <span class="badge-status ${status}">${status}</span>
                    </div>

                    <div class="appointment-details">
                        <div class="detail-line">
                            <i class="fas fa-cut"></i>
                            <span>${servico}</span>
                        </div>
                        <div class="detail-line">
                            <i class="far fa-calendar-alt"></i>
                            <span>${dataFormatada} às <strong>${hora}</strong></span>
                        </div>
                        <div class="detail-line">
                            <i class="fab fa-whatsapp"></i>
                            <span>
                                ${escapeHtml(agendamento.telefone || 'Sem telefone')}
                                ${linkWhats ? `<a href="${linkWhats}" target="_blank" style="margin-left: 6px; color: #34D399; font-size: 0.82rem;" title="Conversar no WhatsApp"><i class="fas fa-external-link-alt"></i> Abrir</a>` : ''}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="appointment-actions">
                    ${status !== 'concluido' ? `
                        <button onclick="atualizarStatus(${agendamento.id}, 'concluido')" class="btn btn-success btn-sm" style="flex: 1;" title="Marcar como Concluído">
                            <i class="fas fa-check"></i> Concluir
                        </button>
                    ` : ''}

                    ${status !== 'cancelado' ? `
                        <button onclick="atualizarStatus(${agendamento.id}, 'cancelado')" class="btn btn-outline-danger btn-sm" style="flex: 1;" title="Cancelar Agendamento">
                            <i class="fas fa-ban"></i> Cancelar
                        </button>
                    ` : ''}

                    <button onclick="deletarAgendamento(${agendamento.id})" class="btn btn-outline btn-sm" title="Excluir do Registro" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.3);">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function atualizarStatus(agendamentoId, novoStatus) {
    try {
        const { error } = await supabaseClient
            .from('agendamentos')
            .update({ status: novoStatus })
            .eq('id', agendamentoId)
            .eq('barbearia_id', barbeariaAtual.id);

        if (error) throw error;

        const index = todosAgendamentos.findIndex(a => a.id === agendamentoId);
        if (index !== -1) {
            todosAgendamentos[index].status = novoStatus;
        }

        atualizarMetricas(todosAgendamentos);
        renderizarAgendamentos();
        mostrarAlertaPainel(`Agendamento atualizado para "${novoStatus}"!`, 'success');

    } catch (err) {
        console.error('Erro ao atualizar agendamento:', err);
        mostrarAlertaPainel('Falha ao atualizar o agendamento.', 'danger');
    }
}

async function deletarAgendamento(agendamentoId) {
    const confirmou = confirm('Tem certeza que deseja excluir permanentemente este agendamento?');
    if (!confirmou) return;

    try {
        const { error } = await supabaseClient
            .from('agendamentos')
            .delete()
            .eq('id', agendamentoId)
            .eq('barbearia_id', barbeariaAtual.id);

        if (error) throw error;

        todosAgendamentos = todosAgendamentos.filter(a => a.id !== agendamentoId);
        atualizarMetricas(todosAgendamentos);
        renderizarAgendamentos();
        mostrarAlertaPainel('Agendamento excluído com sucesso.', 'info');

    } catch (err) {
        console.error('Erro ao excluir agendamento:', err);
        mostrarAlertaPainel('Falha ao excluir o agendamento.', 'danger');
    }
}

function filtrarStatus(status, elementoBtn) {
    filtroStatusAtual = status;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (elementoBtn) elementoBtn.classList.add('active');
    renderizarAgendamentos();
}

function filtrarData(valorData) {
    filtroDataAtual = valorData;
    renderizarAgendamentos();
}

function limparFiltroData() {
    const input = document.getElementById('filtroData');
    if (input) input.value = '';
    filtroDataAtual = '';
    renderizarAgendamentos();
}

async function recarregarAgendamentos() {
    const icon = document.getElementById('refreshIcon');
    if (icon) icon.classList.add('fa-spin');
    await buscarAgendamentos();
    setTimeout(() => {
        if (icon) icon.classList.remove('fa-spin');
    }, 500);
}

// ==========================================================================
// MÓDULO: GESTÃO DE SERVIÇOS DO BARBEIRO (CRUD)
// ==========================================================================

async function buscarServicos() {
    if (!barbeariaAtual) return;

    try {
        const { data: servicos, error } = await supabaseClient
            .from('servicos')
            .select('*')
            .eq('barbearia_id', barbeariaAtual.id)
            .order('id', { ascending: true });

        if (error) throw error;

        todosServicos = servicos || [];
        renderizarServicosPainel();

    } catch (err) {
        console.error('Erro ao carregar serviços:', err);
        mostrarAlertaPainel('Erro ao carregar serviços.', 'danger');
    }
}

function renderizarServicosPainel() {
    const container = document.getElementById('listaServicosPainel');
    if (!container) return;

    if (todosServicos.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-cut"></i>
                <h3>Nenhum serviço cadastrado</h3>
                <p style="margin-bottom: 15px;">Cadastre os serviços que você oferece para seus clientes poderem agendar online.</p>
                <button onclick="abrirModalNovoServico()" class="btn btn-primary btn-sm">
                    <i class="fas fa-plus"></i> Adicionar Primeiro Serviço
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = todosServicos.map(s => {
        const preco = Number(s.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `
            <div class="service-card" style="text-align: left; align-items: flex-start; justify-content: space-between;">
                <div style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <h3 style="margin: 0; font-size: 1.3rem;">${escapeHtml(s.nome)}</h3>
                        <span class="service-price" style="margin: 0; font-size: 1.3rem;">${preco}</span>
                    </div>
                    <p style="margin-bottom: 15px;">${escapeHtml(s.descricao || 'Sem descrição cadastrada.')}</p>
                </div>

                <div style="display: flex; gap: 10px; width: 100%; border-top: 1px solid var(--border-color); padding-top: 15px;">
                    <button onclick="abrirModalEditarServico(${s.id})" class="btn btn-outline btn-sm" style="flex: 1;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="excluirServico(${s.id})" class="btn btn-outline-danger btn-sm" title="Excluir Serviço">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function abrirModalNovoServico() {
    document.getElementById('modalServicoTitulo').textContent = 'Novo Serviço';
    document.getElementById('servicoId').value = '';
    document.getElementById('servicoNome').value = '';
    document.getElementById('servicoPreco').value = '';
    document.getElementById('servicoDescricao').value = '';
    document.getElementById('modalServico').classList.add('active');
}

function abrirModalEditarServico(servicoId) {
    const s = todosServicos.find(item => item.id === servicoId);
    if (!s) return;

    document.getElementById('modalServicoTitulo').textContent = 'Editar Serviço';
    document.getElementById('servicoId').value = s.id;
    document.getElementById('servicoNome').value = s.nome;
    document.getElementById('servicoPreco').value = s.preco;
    document.getElementById('servicoDescricao').value = s.descricao || '';
    document.getElementById('modalServico').classList.add('active');
}

function fecharModalServico() {
    document.getElementById('modalServico').classList.remove('active');
}

async function salvarServico(e) {
    e.preventDefault();

    const id = document.getElementById('servicoId').value;
    const nome = document.getElementById('servicoNome').value.trim();
    const preco = parseFloat(document.getElementById('servicoPreco').value);
    const descricao = document.getElementById('servicoDescricao').value.trim();
    const btnSalvar = document.getElementById('btnSalvarServico');

    if (!nome || isNaN(preco)) {
        alert('Informe ao menos o nome e o preço do serviço.');
        return;
    }

    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gravando...';
    btnSalvar.disabled = true;

    try {
        if (id) {
            // Edição / UPDATE
            const { error } = await supabaseClient
                .from('servicos')
                .update({ nome, preco, descricao })
                .eq('id', id)
                .eq('barbearia_id', barbeariaAtual.id);

            if (error) throw error;
            mostrarAlertaPainel('Serviço atualizado com sucesso!', 'success');
        } else {
            // Criação / INSERT
            const { error } = await supabaseClient
                .from('servicos')
                .insert([
                    {
                        barbearia_id: barbeariaAtual.id,
                        nome,
                        preco,
                        descricao
                    }
                ]);

            if (error) throw error;
            mostrarAlertaPainel('Novo serviço adicionado ao seu salão!', 'success');
        }

        fecharModalServico();
        await buscarServicos();

    } catch (err) {
        console.error('Erro ao salvar serviço:', err);
        alert('Falha ao salvar serviço no banco de dados.');
    } finally {
        btnSalvar.innerHTML = textoOriginal;
        btnSalvar.disabled = false;
    }
}

async function excluirServico(servicoId) {
    const confirmou = confirm('Deseja realmente excluir este serviço? Ele não aparecerá mais para novos agendamentos.');
    if (!confirmou) return;

    try {
        const { error } = await supabaseClient
            .from('servicos')
            .delete()
            .eq('id', servicoId)
            .eq('barbearia_id', barbeariaAtual.id);

        if (error) throw error;

        todosServicos = todosServicos.filter(s => s.id !== servicoId);
        renderizarServicosPainel();
        mostrarAlertaPainel('Serviço excluído com sucesso.', 'info');

    } catch (err) {
        console.error('Erro ao excluir serviço:', err);
        mostrarAlertaPainel('Não foi possível excluir o serviço.', 'danger');
    }
}

// ==========================================================================
// LOGOUT E AUXILIARES
// ==========================================================================

async function fazerLogout() {
    try {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
    } catch (e) {
        console.error('Erro durante logout:', e);
    } finally {
        window.location.href = 'login.html';
    }
}

function mostrarAlertaPainel(mensagem, tipo = 'info') {
    const alertBox = document.getElementById('painelAlert');
    if (!alertBox) return;

    alertBox.className = `alert alert-${tipo}`;
    alertBox.innerHTML = `<i class="fas fa-bell"></i> <span>${mensagem}</span>`;
    alertBox.style.display = 'flex';

    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 4000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
