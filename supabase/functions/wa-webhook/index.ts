// Recebe mensagens do WhatsApp Cloud API (Meta) e grava no CRM.
// Deploy: supabase functions deploy wa-webhook --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') { // verificacao do webhook pela Meta
    return url.searchParams.get('hub.verify_token') === Deno.env.get('WA_VERIFY_TOKEN')
      ? new Response(url.searchParams.get('hub.challenge'))
      : new Response('forbidden', { status: 403 });
  }
  const body = await req.json();
  for (const e of body.entry ?? []) for (const ch of e.changes ?? []) {
    const v = ch.value;
    for (const m of v.messages ?? []) {
      const tel = m.from as string;
      const nome = v.contacts?.[0]?.profile?.name ?? null;
      const texto = m.text?.body ?? `[${m.type}]`;
      let { data: c } = await sb.from('wa_conversas').select('id').eq('telefone', tel).maybeSingle();
      if (!c) {
        const { data: cli } = await sb.rpc('wa_achar_cliente', { p: tel });
        ({ data: c } = await sb.from('wa_conversas').insert({ telefone: tel, nome, cliente_id: cli }).select('id').single());
      }
      await sb.from('wa_mensagens').insert({ conversa_id: c!.id, direcao: 'in', texto, status: 'recebida', wa_id: m.id });
    }
  }
  return new Response('ok');
});
