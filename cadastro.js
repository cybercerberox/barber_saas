// ==========================================================================
// ONBOARDING PÓS-PAGAMENTO - cadastro.js
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initSlugGenerator();

    const form = document.getElementById('cadastroForm');
    if (form) {
        form.addEventListener('submit', processarCadastroBarbearia);
    }
});

// 1. GERADOR E MÁSCARA AUTOMÁTICA DE SLUG
function initSlugGenerator() {
    const nomeInput = document.getElementById('nomeSalao');
    const slugInput = document.getElementById('slug');
    const slugPreview = document.getElementById('slugPreview');

    let slugEditadoManualmente = false;

    slugInput.addEventListener('input', (e) => {
        slugEditadoManualmente = true;
        const limpo = sanitizarSlug(e.target.value);
        e.target.value = limpo;
        atualizarPreview(limpo);
    });

    nomeInput.addEventListener('input', (e) => {
        if (!slugEditadoManualmente || slugInput.value.trim() === '') {
            const gerado = sanitizarSlug(e.target.value);
            slugInput.value = gerado;
            atualizarPreview(gerado);
        }
    });

    function atualizarPreview(slug) {
        const texto = slug || 'seu-salao';
        if (slugPreview) {
            slugPreview.innerHTML = `index.html?salao=<strong>${texto}</strong>`;
        }
    }
}

function sanitizarSlug(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD') // Separa acentos
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
        .trim()
        .replace(/[\s_]+/g, '-') // Converte espaços e underlines para hífens
        .replace(/-+/g, '-'); // Remove hífens duplicados
}

// 2. PROCESSAR O ONBOARDING COMPLETO (SIGNUP + INSERT BARBEARIA + SERVIÇOS INICIAIS)
async function processarCadastroBarbearia(e) {
    e.preventDefault();

    const alertBox = document.getElementById('cadastroAlert');
    if (alertBox) alertBox.style.display = 'none';

    const nomeSalao = document.getElementById('nomeSalao').value.trim();
    const slug = sanitizarSlug(document.getElementById('slug').value);
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const btnSubmit = document.getElementById('btnCadastroSubmit');

    if (!nomeSalao || !slug || !email || !senha) {
        mostrarAlertaCadastro('Por favor, preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    if (senha.length < 6) {
        mostrarAlertaCadastro('A senha deve conter pelo menos 6 caracteres.', 'warning');
        return;
    }

    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando sua conta e salão...';
    btnSubmit.disabled = true;

    try {
        if (!supabaseClient) {
            throw new Error('Supabase Client não inicializado. Verifique supabase-config.js');
        }

        // PASSO 1: Criar o usuário no Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: senha
        });

        if (authError) {
            throw authError;
        }

        let userId = authData.user ? authData.user.id : null;

        // Caso a sessão não venha de imediato, efetua login explícito para garantir o token JWT para o RLS
        if (!authData.session) {
            const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: senha
            });

            if (!loginError && loginData?.user) {
                userId = loginData.user.id;
            }
        }

        if (!userId) {
            throw new Error('Não foi possível identificar o ID do usuário cadastrado.');
        }

        // PASSO 2: Fazer o INSERT na tabela barbearias com o owner_id correspondente
        const { data: barbData, error: barbError } = await supabaseClient
            .from('barbearias')
            .insert([
                {
                    owner_id: userId,
                    nome_salao: nomeSalao,
                    slug: slug
                }
            ])
            .select()
            .single();

        if (barbError) {
            if (barbError.code === '23505' || (barbError.message && barbError.message.toLowerCase().includes('slug'))) {
                throw new Error(`O identificador de URL "${slug}" já está em uso por outro salão. Por favor, escolha outro slug.`);
            }
            throw barbError;
        }

        // PASSO 3: Cadastrar 3 serviços iniciais padrão (para o salão já iniciar pronto, podendo ser editado depois)
        try {
            await supabaseClient.from('servicos').insert([
                {
                    barbearia_id: barbData.id,
                    nome: 'Corte Tradicional',
                    preco: 45.00,
                    descricao: 'Corte completo com tesoura ou máquina, acabamento refinado e lavagem.'
                },
                {
                    barbearia_id: barbData.id,
                    nome: 'Barba Terapia Completa',
                    preco: 35.00,
                    descricao: 'Alinhamento na navalha com toalha quente e óleos essenciais.'
                },
                {
                    barbearia_id: barbData.id,
                    nome: 'Combo Cabelo + Barba',
                    preco: 70.00,
                    descricao: 'O pacote completo para o seu visual com tratamento especial.'
                }
            ]);
        } catch (servError) {
            console.warn('Aviso ao criar serviços padrão iniciais:', servError);
        }

        mostrarAlertaCadastro('Barbearia cadastrada com sucesso! Redirecionando para o seu painel...', 'success');

        // Redireciona para o painel administrativo
        setTimeout(() => {
            window.location.href = 'painel.html';
        }, 1200);

    } catch (err) {
        console.error('Erro no cadastro da barbearia:', err);

        let msg = err.message || 'Falha ao realizar o cadastro. Tente novamente.';
        if (msg.toLowerCase().includes('already registered')) {
            msg = 'Este e-mail já está cadastrado no sistema. Faça login ou use outro e-mail.';
        }

        mostrarAlertaCadastro(msg, 'danger');
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
    }
}

function mostrarAlertaCadastro(mensagem, tipo = 'danger') {
    const alertBox = document.getElementById('cadastroAlert');
    if (!alertBox) {
        alert(mensagem);
        return;
    }
    alertBox.className = `alert alert-${tipo}`;
    alertBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${mensagem}</span>`;
    alertBox.style.display = 'flex';
}
