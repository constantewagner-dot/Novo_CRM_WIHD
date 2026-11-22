// WIHD CRM - Chat WhatsApp (usa globais do index.html: sb, $, esc, cn, clientes, ENT, list, toast)
(function () {
  let convs = [], atual = null, modelos = [], canal = null, aba = 'conv';
  const digits = s => String(s || '').replace(/\D/g, '');
  const hora = t => new Date(t).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
  const nomeConv = c => (c.cliente_id && cn(c.cliente_id) !== '—') ? cn(c.cliente_id) : (c.nome || '+' + c.telefone);

  function css() {
    if ($('wa_css')) return;
    const s = document.createElement('style'); s.id = 'wa_css';
    s.textContent = `.wa{display:grid;grid-template-columns:320px 1fr;height:72vh;background:var(--card);border-radius:8px;overflow:hidden}
.wl{border-right:1px solid var(--ln);overflow:auto}.wl input{width:calc(100% - 20px);margin:10px;padding:8px 10px;border:1px solid var(--ln);border-radius:8px}
.wi{padding:10px 14px;border-bottom:1px solid var(--ln);cursor:pointer}.wi:hover{background:var(--soft)}.wi.on{background:var(--warm)}
.wi small{display:block;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nl{background:var(--gold);color:var(--navy);border-radius:20px;padding:0 8px;font-size:.8rem;font-weight:700;float:right}
.wc{display:flex;flex-direction:column;min-width:0}.wh{padding:10px 16px;background:var(--navy);color:#fff}.wh small{color:#cdd6e6}
.wm{flex:1;overflow:auto;padding:14px;background:var(--chat);display:flex;flex-direction:column;gap:6px}
.wb{max-width:72%;padding:8px 12px;border-radius:10px;background:var(--card);align-self:flex-start;white-space:pre-wrap;word-break:break-word}
.wb.out{background:var(--bout);align-self:flex-end}.wb small{display:block;color:var(--mut);font-size:.72rem}
.wf{display:flex;gap:8px;padding:10px;border-top:1px solid var(--ln);flex-wrap:wrap}.wf textarea{flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--ln);border-radius:8px}
.wf select{padding:8px;border:1px solid var(--ln);border-radius:8px;max-width:160px}.wv{margin:auto;color:var(--mut)}
@media(max-width:800px){.wa{grid-template-columns:1fr;height:auto}.wl{max-height:260px}.wm{min-height:300px}}`;
    document.head.appendChild(s);
  }

  async function loadConvs() { const {data} = await sb.from('wa_conversas').select('*').order('ultima_em', {ascending: false, nullsFirst: false}); convs = data || []; }

  async function run() {
    css();
    ENT.wa_modelos = {l: 'Modelos', tb: 'wa_modelos', order: 'titulo', box: 'lbox', f: [{k: 'titulo', l: 'Título', w: 1, req: 1}, {k: 'texto', l: 'Texto (use {nome} para o nome do cliente)', t: 'area', w: 1, req: 1}], cols: ['titulo', 'texto']};
    $('view').innerHTML = `<div style="display:flex;gap:6px;margin-bottom:12px"><button class="btn sm ${aba === 'conv' ? 'gold' : 'sec'}" onclick="Wa.aba('conv')">Conversas</button><button class="btn sm ${aba === 'mod' ? 'gold' : 'sec'}" onclick="Wa.aba('mod')">Modelos de mensagem</button></div><div id="wbox"></div>`;
    if (aba === 'mod') {
      $('wbox').innerHTML = `<div class="bar"><button class="btn gold" onclick="form('wa_modelos')">+ Novo modelo</button></div><div id="lbox"></div>`;
      return list('wa_modelos');
    }
    const [, m] = await Promise.all([loadConvs(), sb.from('wa_modelos').select('*').order('titulo')]);
    modelos = m.data || [];
    $('wbox').innerHTML = `<div class="wa"><div class="wl"><div style="display:flex;gap:6px;padding:10px 10px 0"><button class="btn gold sm" style="flex:1" onclick="Wa.nova()">+ Nova conversa</button></div><input id="wa_q" placeholder="Buscar…" oninput="Wa.lista()"><div id="wa_list"></div></div><div class="wc" id="wa_chat"></div></div>`;
    lista(); chat();
    if (canal) sb.removeChannel(canal);
    canal = sb.channel('wa-live').on('postgres_changes', {event: '*', schema: 'public', table: 'wa_mensagens'}, async p => {
      if (!$('wa_list')) return; // saiu da tela
      await loadConvs(); lista();
      if (atual && p.new?.conversa_id === atual) { msgs(); sb.from('wa_conversas').update({nao_lidas: 0}).eq('id', atual); }
    }).subscribe();
  }

  function lista() {
    const q = ($('wa_q')?.value || '').toLowerCase();
    $('wa_list').innerHTML = convs.filter(c => (nomeConv(c) + c.telefone).toLowerCase().includes(q)).map(c => `<div class="wi ${c.id === atual ? 'on' : ''}" onclick="Wa.abrir('${c.id}')">
      ${c.nao_lidas ? `<span class="nl">${c.nao_lidas}</span>` : ''}<b>${esc(nomeConv(c))}</b><small>${esc(c.ultima_msg || 'Sem mensagens')}</small></div>`).join('') || '<p style="padding:14px;color:var(--mut)">Nenhuma conversa. Clique em “+ Nova conversa”.</p>';
  }

  function chat() {
    const c = convs.find(x => x.id === atual);
    if (!c) return $('wa_chat').innerHTML = '<p class="wv">Selecione uma conversa</p>';
    $('wa_chat').innerHTML = `<div class="wh"><b>${esc(nomeConv(c))}</b> <small>+${esc(c.telefone)}</small></div><div class="wm" id="wa_msgs"></div>
      <div class="wf"><select id="wa_mod" onchange="Wa.modelo()"><option value="">Modelos…</option>${modelos.map(m => `<option value="${m.id}">${esc(m.titulo)}</option>`).join('')}</select>
      <textarea id="wa_txt" rows="2" placeholder="Escreva uma mensagem" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();Wa.enviar()}"></textarea><button class="btn gold" onclick="Wa.enviar()">Enviar</button></div>`;
    msgs();
  }

  async function msgs() {
    const {data} = await sb.from('wa_mensagens').select('*').eq('conversa_id', atual).order('criado_em').limit(300);
    const box = $('wa_msgs'); if (!box) return;
    box.innerHTML = (data || []).map(m => `<div class="wb ${m.direcao}">${esc(m.texto)}<small>${hora(m.criado_em)}${m.status === 'manual' ? ' · enviada pelo WhatsApp do aparelho' : ''}</small></div>`).join('') || '<p class="wv">Sem mensagens ainda.</p>';
    box.scrollTop = box.scrollHeight;
  }

  async function abrir(id) {
    atual = id; chat();
    await sb.from('wa_conversas').update({nao_lidas: 0}).eq('id', id);
    await loadConvs(); lista();
  }

  function modelo() {
    const m = modelos.find(x => x.id === $('wa_mod').value); if (!m) return;
    const c = convs.find(x => x.id === atual);
    $('wa_txt').value = m.texto.replace(/\{nome\}/g, nomeConv(c).split(' ')[0]);
    $('wa_mod').value = ''; $('wa_txt').focus();
  }

  async function enviar() {
    const ta = $('wa_txt'), texto = ta.value.trim(); if (!texto || !atual) return;
    const c = convs.find(x => x.id === atual);
    const {data} = await sb.functions.invoke('wa-send', {body: {conversa_id: atual, texto}});
    if (data?.ok) { ta.value = ''; return msgs(); }
    if (data?.motivo === 'erro') return toast('O WhatsApp não enviou: ' + data.detalhe, 1);
    // Sem integração configurada: abre o WhatsApp e registra a mensagem no histórico
    window.open(`https://wa.me/${c.telefone}?text=${encodeURIComponent(texto)}`, '_blank');
    await sb.from('wa_mensagens').insert({conversa_id: atual, direcao: 'out', texto, status: 'manual'});
    ta.value = ''; toast('WhatsApp aberto. A mensagem ficou registrada aqui.'); msgs();
  }

  function nova() {
    $('dt').textContent = 'Nova conversa';
    $('db').innerHTML = `<div class="w"><label>Cliente</label><select id="wn_cli"><option value="">— Número avulso —</option>${clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="w"><label>Telefone com DDD (usado se não escolher cliente, ou se o cliente não tiver telefone)</label><input id="wn_tel" placeholder="(47) 99999-8888"></div>`;
    $('df').innerHTML = '<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Wa.criar()">Abrir conversa</button>';
    $('dlg').showModal();
  }

  async function criar() {
    const cid = $('wn_cli').value; let tel = digits($('wn_tel').value);
    if (cid && !tel) { const {data} = await sb.from('clientes').select('telefone').eq('id', cid).single(); tel = digits(data?.telefone); }
    if (tel.length < 10) return toast('Informe um telefone válido com DDD.', 1);
    if (tel.length <= 11) tel = '55' + tel;
    let c = convs.find(x => x.telefone === tel);
    if (!c) {
      const {data, error} = await sb.from('wa_conversas').insert({telefone: tel, cliente_id: cid || null}).select().single();
      if (error) return toast(error.message, 1);
      c = data; await loadConvs();
    }
    $('dlg').close(); abrir(c.id);
  }

  window.Wa = {aba: k => { aba = k; run(); }, lista, abrir, modelo, enviar, nova, criar};
  window.EXTRA = Object.assign(window.EXTRA || {}, {whatsapp: {l: 'WhatsApp', run}});
})();
