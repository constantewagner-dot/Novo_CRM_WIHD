// WIHD CRM - Orçamentos (cotações) com página pública para o cliente
(function () {
  const PROMPT = `Você vai ler o(s) print(s) anexado(s) de passagens aéreas e/ou de hospedagem e extrair os dados para um orçamento de viagem.
Responda APENAS com um JSON válido, sem texto antes ou depois e sem explicações, neste formato:
{"origem_cidade":"","destino_cidade":"","adultos":1,"criancas":0,
"voos":[{"tipo":"ida","data":"AAAA-MM-DD","origem":"FLN","destino":"GIG","hora_saida":"17:55","hora_chegada":"19:25","companhia":"LATAM","duracao":"1h30min","escalas":"Direto","numero_voo":""}],
"hospedagens":[{"nome":"","endereco":"","nota":"","checkin":"AAAA-MM-DD","checkout":"AAAA-MM-DD","quartos":1,"regime":"","tipo_quarto":""}]}
Regras: "tipo" do voo é "ida", "volta" ou "trecho". Use datas no formato AAAA-MM-DD (se o ano não aparecer, use a próxima data futura). Origem e destino do voo são os códigos IATA de 3 letras. Use "" quando uma informação não estiver visível. Não invente informações e não inclua preços.`;
  let O = null, lista = [], agencia = {};
  const n = x => Number(x || 0);
  const vazio = () => ({id: '', cliente_id: '', status: 'rascunho', titulo: '', dados: {cliente_nome: '', adultos: 1, criancas: 0, capa: '', voos: [], hospedagens: [], valor_voos: 0, valor_hosp: 0, valor_outros: 0, desconto: 0, parcelas: 10,
    condicoes: 'Pague em 4x sem juros ou em até 18x com juros. Ganhe 5% de desconto no pix.', agente: agencia.ag_agente || '', agente_tel: agencia.ag_telefone || ''}});
  const link = t => location.origin + location.pathname.replace(/[^/]*$/, '') + 'orcamento.html?t=' + t;
  const inp = (k, l, v, t = 'text') => `<div><label>${l}</label><input data-k="${k}" type="${t}" value="${esc(v ?? '')}"></div>`;
  const sel = (k, l, v, o) => `<div><label>${l}</label><select data-k="${k}">${o.map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`;
  const rows = id => [...document.querySelectorAll(`#${id} .oc-row`)].map(r => Object.fromEntries([...r.querySelectorAll('[data-k]')].map(e => [e.dataset.k, e.value])));

  function css() {
    if ($('oc_css')) return; const s = document.createElement('style'); s.id = 'oc_css';
    s.textContent = `.oc-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:8px}.oc-row{border:1px solid var(--ln);border-radius:8px;padding:10px;margin-bottom:8px}
.oc-sec{background:var(--card);border-radius:8px;padding:14px;margin-bottom:12px}.oc-sec h3{margin:0 0 8px;font-size:1.4rem}.oc-sec label{display:block;font-size:.85rem;color:var(--mut)}
.oc-sec input,.oc-sec select,.oc-sec textarea{width:100%;padding:8px 10px;border:1px solid var(--ln);border-radius:8px}`;
    document.head.appendChild(s);
  }

  async function run() {
    css(); O = null;
    const [a, c] = await Promise.all([sb.from('orcamentos').select('id,codigo,cliente_id,titulo,status,valor_final,token,atualizado_em,cn:dados->>cliente_nome').order('atualizado_em', {ascending: false}).limit(300), sb.from('config_app').select('*').maybeSingle()]);
    lista = a.data || []; agencia = c.data || {};
    $('view').innerHTML = `<div class="bar" style="flex-wrap:wrap"><button class="btn gold" onclick="Orc.abrir()">+ Novo orçamento</button><button class="btn sec" onclick="Orc.agencia()">Dados da agência</button></div>
      <div class="panel"><table><tr><th>Código</th><th>Cliente</th><th>Título</th><th>Valor final</th><th>Status</th><th>Atualizado</th><th></th></tr>
      ${lista.map(o => `<tr><td>#${esc(o.codigo)}</td><td>${esc(o.cliente_id ? cn(o.cliente_id) : o.cn || '—')}</td><td>${esc(o.titulo)}</td><td><b>${brl(o.valor_final)}</b></td><td><span class="tag">${esc(o.status)}</span></td><td>${dt((o.atualizado_em || '').slice(0, 10))}</td>
      <td><button class="btn sm sec" onclick="Orc.abrir('${o.id}')">Editar</button> <button class="btn sm sec" onclick="window.open(Orc.link('${o.token}'),'_blank')">Ver</button> <button class="btn sm sec" onclick="Orc.copiar('${o.token}')">Copiar link</button> <button class="btn sm gold" onclick="Orc.zap('${o.id}')">WhatsApp</button>${me.role === 'admin' ? ` <button class="btn sm bad" onclick="Orc.del('${o.id}')">Excluir</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7">Nenhum orçamento ainda. Clique em “+ Novo orçamento”.</td></tr>'}</table></div>`;
  }

  async function abrir(id) {
    if (id) { const {data, error} = await sb.from('orcamentos').select('*').eq('id', id).single(); if (error) return toast(error.message, 1); O = {...vazio(), ...data, dados: {...vazio().dados, ...data.dados}}; }
    else O = vazio();
    desenha();
  }

  function desenha() {
    const d = O.dados, v = (x, k) => `${esc(x[k] ?? '')}`;
    const voo = (x, i) => `<div class="oc-row"><div class="oc-g">${sel('tipo', 'Tipo', x.tipo, ['ida', 'volta', 'trecho'])}${inp('data', 'Data', x.data, 'date')}${inp('origem', 'Origem (IATA)', x.origem)}${inp('destino', 'Destino (IATA)', x.destino)}${inp('hora_saida', 'Saída', x.hora_saida, 'time')}${inp('hora_chegada', 'Chegada', x.hora_chegada, 'time')}${inp('companhia', 'Companhia', x.companhia)}${inp('duracao', 'Duração', x.duracao)}${inp('escalas', 'Escalas', x.escalas || 'Direto')}${inp('numero_voo', 'Nº do voo', x.numero_voo)}</div><button class="btn sm bad" onclick="Orc.rm('voos',${i})">Remover voo</button></div>`;
    const hos = (x, i) => `<div class="oc-row"><div class="oc-g">${inp('nome', 'Hotel', x.nome)}${inp('endereco', 'Endereço', x.endereco)}${inp('nota', 'Nota (ex.: 4,8 no Google)', x.nota)}${inp('checkin', 'Check-in', x.checkin, 'date')}${inp('checkout', 'Check-out', x.checkout, 'date')}${inp('quartos', 'Quartos', x.quartos || 1, 'number')}${inp('regime', 'Regime (café da manhã…)', x.regime)}${inp('tipo_quarto', 'Tipo de quarto', x.tipo_quarto)}${inp('foto', 'Link da foto (opcional)', x.foto)}</div><button class="btn sm bad" onclick="Orc.rm('hospedagens',${i})">Remover hospedagem</button></div>`;
    const num = (id, l, val) => `<div><label>${l}</label><input id="${id}" type="number" step="any" value="${val ?? 0}" oninput="Orc.total()"></div>`;
    $('view').innerHTML = `<div class="oc-sec"><h3>1. Importar do print com o Claude (grátis)</h3><ol style="margin:0 0 8px;padding-left:20px;color:var(--mut)"><li>Clique em <b>Copiar instruções</b>.</li><li>Abra <b>claude.ai</b> (conta gratuita), cole as instruções e anexe o print do voo ou do hotel.</li><li>Copie a resposta do Claude, cole abaixo e clique em <b>Preencher</b>. Repita para cada print.</li></ol>
      <button class="btn gold" onclick="Orc.copiarPrompt()">Copiar instruções</button> <a class="btn sec" href="https://claude.ai/new" target="_blank" style="text-decoration:none;display:inline-block">Abrir claude.ai</a>
      <textarea id="o_json" rows="4" placeholder="Cole aqui a resposta do Claude (o texto que começa com {)" style="margin-top:8px"></textarea><button class="btn" style="margin-top:6px" onclick="Orc.importar()">Preencher</button></div>
      <div class="oc-sec"><h3>2. Dados gerais</h3><div class="oc-g"><div><label>Cliente</label><select id="o_cli"><option value="">— Selecionar —</option>${clientes.map(c => `<option value="${c.id}" ${c.id === O.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      <div><label>ou nome (se não for cadastrado)</label><input id="o_cn" value="${v(d, 'cliente_nome')}"></div><div><label>Título *</label><input id="o_tit" value="${esc(O.titulo)}" placeholder="Floripa - Rio de Janeiro"></div>
      <div><label>Status</label><select id="o_sta">${['rascunho', 'enviado', 'aprovado', 'recusado'].map(s => `<option ${s === O.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label>Adultos</label><input id="o_ad" type="number" min="1" value="${d.adultos}"></div><div><label>Crianças</label><input id="o_cr" type="number" min="0" value="${d.criancas}"></div>
      <div><label>Foto de capa (link, opcional)</label><input id="o_capa" value="${v(d, 'capa')}"></div></div></div>
      <div class="oc-sec"><h3>3. Voos</h3><div id="oc_voos">${d.voos.map(voo).join('')}</div><button class="btn sm sec" onclick="Orc.add('voos')">+ Voo</button></div>
      <div class="oc-sec"><h3>4. Hospedagem</h3><div id="oc_hosp">${d.hospedagens.map(hos).join('')}</div><button class="btn sm sec" onclick="Orc.add('hospedagens')">+ Hospedagem</button></div>
      <div class="oc-sec"><h3>5. Valores</h3><div class="oc-g">${num('o_vv', 'Voos (R$)', d.valor_voos)}${num('o_vh', 'Hospedagem (R$)', d.valor_hosp)}${num('o_vo', 'Outros serviços (R$)', d.valor_outros)}${num('o_de', 'Desconto / economia (R$)', d.desconto)}
      <div><label>Parcelas sem juros</label><input id="o_pa" type="number" min="1" value="${d.parcelas}" oninput="Orc.total()"></div></div><div id="o_tot" style="margin:8px 0;padding:10px;background:var(--soft);border-radius:8px"></div>
      <label>Condições de pagamento</label><textarea id="o_con" rows="2">${esc(d.condicoes)}</textarea></div>
      <div class="oc-sec"><h3>6. Agente</h3><div class="oc-g"><div><label>Nome do agente</label><input id="o_ag" value="${v(d, 'agente')}"></div><div><label>Telefone / WhatsApp do agente</label><input id="o_at" value="${v(d, 'agente_tel')}"></div></div></div>
      <div class="bar"><button class="btn gold" onclick="Orc.salvar(false)">Salvar</button><button class="btn" onclick="Orc.salvar(true)">Salvar e ver orçamento</button><button class="btn sec" onclick="Orc.run()">Voltar</button></div>`;
    total();
  }

  function coletar() {
    const d = O.dados, v = id => $(id)?.value ?? '';
    O.cliente_id = v('o_cli'); O.titulo = v('o_tit').trim(); O.status = v('o_sta') || 'rascunho'; d.cliente_nome = v('o_cn'); d.adultos = parseInt(v('o_ad')) || 1; d.criancas = parseInt(v('o_cr')) || 0; d.capa = v('o_capa');
    d.voos = rows('oc_voos'); d.hospedagens = rows('oc_hosp'); d.valor_voos = n(v('o_vv')); d.valor_hosp = n(v('o_vh')); d.valor_outros = n(v('o_vo')); d.desconto = n(v('o_de')); d.parcelas = parseInt(v('o_pa')) || 1;
    d.condicoes = v('o_con'); d.agente = v('o_ag'); d.agente_tel = v('o_at');
  }
  function total() {
    const s = n($('o_vv')?.value) + n($('o_vh')?.value) + n($('o_vo')?.value), de = n($('o_de')?.value), f = s - de, p = parseInt($('o_pa')?.value) || 1; if (!$('o_tot')) return;
    $('o_tot').innerHTML = `Soma <b>${brl(s)}</b> · Desconto <b>${brl(de)}</b>${s ? ` (${Math.round(de / s * 100)}% OFF)` : ''} · <b>Valor final ${brl(f)}</b> · ${p}x de <b>${brl(f / p)}</b> sem juros`;
  }
  function add(c) { coletar(); O.dados[c].push(c === 'voos' ? {tipo: O.dados.voos.length ? 'volta' : 'ida', escalas: 'Direto'} : {quartos: 1}); desenha(); }
  function rm(c, i) { coletar(); O.dados[c].splice(i, 1); desenha(); }
  function importar() {
    const t = $('o_json').value, i = t.indexOf('{'), j = t.lastIndexOf('}'); let r;
    try { r = JSON.parse(t.slice(i, j + 1)); } catch (e) { return toast('Não consegui ler o texto. Cole exatamente a resposta do Claude.', 1); }
    coletar(); const d = O.dados;
    (r.voos || []).forEach(x => d.voos.push({...x, tipo: x.tipo || 'trecho'})); (r.hospedagens || []).forEach(x => d.hospedagens.push(x));
    if (r.adultos) d.adultos = r.adultos; if (r.criancas != null) d.criancas = r.criancas;
    if (!O.titulo && (r.origem_cidade || r.destino_cidade)) O.titulo = `${r.origem_cidade || ''} - ${r.destino_cidade || ''}`.replace(/^ - | - $/g, '');
    desenha(); toast('Dados preenchidos. Confira e informe os valores.');
  }
  function copiarPrompt() { navigator.clipboard.writeText(PROMPT).then(() => toast('Instruções copiadas. Cole no claude.ai junto com o print.'), () => toast('Não foi possível copiar automaticamente.', 1)); }

  async function salvar(ver) {
    coletar(); const d = O.dados; if (!O.titulo) return toast('Informe o título (ex.: Floripa - Rio de Janeiro).', 1);
    if (O.cliente_id) d.cliente_nome = cn(O.cliente_id);
    d.agencia = {nome: agencia.ag_nome || 'WIHD Milhas e Viagens', email: agencia.ag_email || '', site: agencia.ag_site || '', cnpj: agencia.ag_cnpj || '', telefone: agencia.ag_telefone || ''};
    const row = {cliente_id: O.cliente_id || null, titulo: O.titulo, status: O.status, dados: d, valor_final: n(d.valor_voos) + n(d.valor_hosp) + n(d.valor_outros) - n(d.desconto), atualizado_em: new Date().toISOString()};
    const {data, error} = await (O.id ? sb.from('orcamentos').update(row).eq('id', O.id) : sb.from('orcamentos').insert(row)).select().single();
    if (error) return toast(error.message, 1);
    toast('Orçamento salvo.'); if (ver) window.open(link(data.token), '_blank'); run();
  }
  function copiar(t) { navigator.clipboard.writeText(link(t)).then(() => toast('Link copiado.'), () => toast(link(t))); }
  async function zap(id) {
    const o = lista.find(x => x.id === id); let tel = '';
    if (o.cliente_id) { const {data} = await sb.from('clientes').select('telefone').eq('id', o.cliente_id).single(); tel = (data?.telefone || '').replace(/\D/g, ''); }
    if (tel && tel.length <= 11) tel = '55' + tel;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(`Olá! Preparei o seu orçamento "${o.titulo}": ${link(o.token)}`)}`, '_blank');
    if (o.status === 'rascunho') sb.from('orcamentos').update({status: 'enviado'}).eq('id', id).then(run);
  }
  async function del(id) { if (!confirm('Excluir este orçamento? O link deixará de funcionar.')) return; const {error} = await sb.from('orcamentos').delete().eq('id', id); toast(error ? error.message : 'Excluído.', !!error); run(); }

  function dadosAgencia() {
    $('dt').textContent = 'Dados da agência (aparecem no orçamento)';
    const f = (id, l, k) => `<div><label>${l}</label><input id="${id}" value="${esc(agencia[k] || '')}"></div>`;
    $('db').innerHTML = f('ag_n', 'Nome da agência', 'ag_nome') + f('ag_a', 'Agente padrão', 'ag_agente') + f('ag_t', 'Telefone / WhatsApp', 'ag_telefone') + f('ag_e', 'E-mail', 'ag_email') + f('ag_s', 'Site', 'ag_site') + f('ag_c', 'CNPJ', 'ag_cnpj');
    $('df').innerHTML = `<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Orc.salvarAgencia()" ${me.role === 'admin' ? '' : 'disabled title="Somente administrador"'}>Salvar</button>`; $('dlg').showModal();
  }
  async function salvarAgencia() {
    const row = {ag_nome: $('ag_n').value, ag_agente: $('ag_a').value, ag_telefone: $('ag_t').value, ag_email: $('ag_e').value, ag_site: $('ag_s').value, ag_cnpj: $('ag_c').value};
    const {error} = await sb.from('config_app').update(row).eq('id', 1); if (error) return toast(error.message, 1); $('dlg').close(); toast('Dados salvos.'); run();
  }

  window.Orc = {run, abrir, rm, add, total, importar, copiarPrompt, salvar, copiar, zap, del, link, agencia: dadosAgencia, salvarAgencia};
  window.EXTRA = Object.assign(window.EXTRA || {}, {orcamentos: {l: 'Orçamentos', run}});
})();
