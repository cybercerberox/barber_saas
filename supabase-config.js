// ==========================================================================
// CONFIGURAÇÃO CENTRALIZADA DO SUPABASE CLIENT
// ==========================================================================
// Este arquivo inicializa a conexão com o Supabase de forma centralizada.
// Todas as páginas do SaaS utilizam este cliente único.

const SUPABASE_URL = "https://hohedpulfobsqaiarnit.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaGVkcHVsZm9ic3FhaWFybml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTM4MDYsImV4cCI6MjEwNzQ4OTgwNn0.QlxAyav9y4r7yNqrA75qZHuuCjj2k5aWAd_GaaYtqe8";

// Garante que o SDK do Supabase foi carregado antes de inicializar
if (!window.supabase) {
    console.error("SDK do Supabase não encontrado. Verifique se o script CDN está incluído.");
}

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
