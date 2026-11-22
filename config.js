// WIHD CRM - Configuração do Supabase (único lugar para editar)
// URL do projeto: Supabase > Project Settings > API > Project URL
// Chave anon/public: Supabase > Project Settings > API > "anon public"
// NUNCA coloque aqui a chave "service_role".
const SUPABASE_URL = 'https://wenlnoiqzaasuogvhuoq.supabase.co';
const SUPABASE_ANON_KEY = 'COLE_AQUI_A_CHAVE_ANON_PUBLIC';
const CONFIG_OK = !SUPABASE_ANON_KEY.startsWith('COLE_');
