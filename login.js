// ==========================================================================
// AUTENTICAÇÃO SAAS - login.js
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Se o usuário já possuir sessão válida ativa, redireciona diretamente para o painel
    if (supabaseClient) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                window.location.href = 'painel.html';
                return;
            }
        } catch (e) {
            console.error('Erro na checagem de sessão prévia:', e);
        }
    }

    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', realizarLogin);
    }
});

async function realizarLogin(e) {
    e.preventDefault();

    const alertBox = document.getElementById('loginAlert');
    if (alertBox) alertBox.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const btnSubmit = document.getElementById('btnLoginSubmit');

    if (!email || !senha) {
        mostrarAlertaLogin('Por favor, preencha todos os campos.', 'warning');
        return;
    }

    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    btnSubmit.disabled = true;

    try {
        if (!supabaseClient) {
            throw new Error('Supabase Client não inicializado. Verifique supabase-config.js');
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: senha
        });

        if (error) {
            throw error;
        }

        mostrarAlertaLogin('Login efetuado com sucesso! Redirecionando...', 'success');

        // Redireciona para o painel administrativo
        setTimeout(() => {
            window.location.href = 'painel.html';
        }, 600);

    } catch (err) {
        console.error('Erro ao efetuar login:', err);

        let mensagemAmigavel = 'E-mail ou senha incorretos. Verifique suas credenciais.';
        if (err.message && err.message.toLowerCase().includes('email not confirmed')) {
            mensagemAmigavel = 'Seu e-mail ainda não foi confirmado. Verifique a caixa de entrada do seu e-mail.';
        } else if (err.message && err.message.toLowerCase().includes('rate limit')) {
            mensagemAmigavel = 'Muitas tentativas em sequência. Por favor, aguarde alguns instantes.';
        }

        mostrarAlertaLogin(mensagemAmigavel, 'danger');
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
    }
}

function mostrarAlertaLogin(mensagem, tipo = 'danger') {
    const alertBox = document.getElementById('loginAlert');
    if (!alertBox) {
        alert(mensagem);
        return;
    }
    alertBox.className = `alert alert-${tipo}`;
    alertBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${mensagem}</span>`;
    alertBox.style.display = 'flex';
}
