// Envia mensagem pelo WhatsApp Cloud API. Exige usuario logado e ativo no CRM.
// Deploy: supabase functions deploy wa-send
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const token = Deno.env.get('WA_TOKEN'), phone = Deno.env.get('WA_PHONE_ID');
  if (!token || !phone) return json({ ok: false, motivo: 'nao_configurado' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ ok: false, motivo: 'erro', detalhe: 'Sessão expirada. Entre novamente.' });

  const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: p } = await sb.from('profiles').select('ativo').eq('id', user.id).single();
  if (!p?.ativo) return json({ ok: false, motivo: 'erro', detalhe: 'Usuário sem acesso.' });

  const { conversa_id, texto } = await req.json();
  const { data: c } = await sb.from('wa_conversas').select('telefone').eq('id', conversa_id).single();
  if (!c) return json({ ok: false, motivo: 'erro', detalhe: 'Conversa não encontrada.' });

  const r = await fetch(`https://graph.facebook.com/v21.0/${phone}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: c.telefone, type: 'text', text: { body: texto } }),
  });
  const j = await r.json();
  if (!r.ok) return json({ ok: false, motivo: 'erro', detalhe: j.error?.message ?? 'Falha ao enviar.' });

  await sb.from('wa_mensagens').insert({ conversa_id, direcao: 'out', texto, status: 'enviada', wa_id: j.messages?.[0]?.id, autor: user.id });
  return json({ ok: true });
});
