// WIHD CRM - CRM em funis (kanban), baseado nos funis do Volly
(function () {
  const FUNIS = {
    'Funil Comercial': [['Novo Contato', '#9aa3b2'], ['Em Cotação', '#3b82f6'], ['Proposta Enviada', '#f59e0b'], ['Aprovado', '#22a366'], ['Perdido', '#e5484d']],
    'Pós-Venda': [['Aguardando Viagem', '#9aa3b2'], ['Em Viagem', '#8b5cf6'], ['Aguardando Feedback', '#f59e0b'], ['Concluído', '#22a366']],
    'Recuperação de Venda': [['Perdido Recente', '#9aa3b2'], ['Contato Realizado', '#3b82f6'], ['Nova Proposta', '#f59e0b'], ['Recuperado', '#22a366']]
  };
  const SERV = ['Emissão de Passagens', 'Consultoria de Milhas', 'Pacotes de Viagem', 'Hospedagem', 'Cruzeiros', 'Grupo Wpp', 'Seguro Viagem', 'Carro', 'Outro'];
  let funil = 'Funil Comercial', rows = [], mes = '', drag = null;
  const nome = n => n.funil || 'Funil Comercial';

  function css() {
    if ($('kb_css')) return;
    const s = document.createElement('style'); s.id = 'kb_css';
    s.textContent = `.kb-top{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.kb-top input,.kb-top select{padding:8px 10px;border:1px solid var(--ln);border-radius:8px;background:var(--card)}#k_q{flex:1;min-width:200px}
.kb{display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;align-items:flex-start}.kc{flex:0 0 280px;background:var(--card);border-radius:8px;border-top:5px solid;display:flex;flex-direction:column;min-height:60vh}
.kh{padding:10px 12px;border-bottom:1px solid var(--ln)}.kh i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px}.kh small{display:block;color:var(--mut)}
.kd{flex:1;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:120px}.kk{background:var(--soft);border:1px solid var(--ln);border-radius:8px;padding:10px;cursor:grab}
.kk span{display:block;color:var(--mut);font-size:.9rem}.kk em{font-style:normal;font-weight:700;color:var(--head)}.ka{padding:10px;text-align:center;color:var(--mut);border-top:1px solid var(--ln);cursor:pointer}.ka:hover{background:var(--soft)}`;
    document.head.appendChild(s);
  }

  async function run() {
    css();
    const {data} = await sb.from('negocios').select('*').order('criado_em', {ascending: false}); rows = data || [];
    $('view').innerHTML = `<div class="kb-top"><select onchange="Funil.troca(this.value)">${Object.keys(FUNIS).map(f => `<option ${f === funil ? 'selected' : ''}>${f}</option>`).join('')}</select>
      <input id="k_q" placeholder="Buscar cliente, título, serviço…" oninput="Funil.desenha()"><input type="month" value="${mes}" onchange="Funil.setMes(this.value)">
      <button class="btn sm sec" onclick="Funil.setMes('')">Todos os meses</button><button class="btn gold" onclick="Funil.form()">+ Novo negócio</button></div><div class="kb" id="kb"></div>`;
    desenha();
  }
  function troca(f) { funil = f; desenha(); }
  function setMes(v) { mes = v; run(); }

  function desenha() {
    const q = ($('k_q')?.value || '').toLowerCase(), etapas = FUNIS[funil];
    const lista = rows.filter(n => nome(n) === funil && (!mes || (n.criado_em || '').startsWith(mes)) && (!q || (n.titulo + ' ' + cn(n.cliente_id) + ' ' + (n.servico || '')).toLowerCase().includes(q)));
    $('kb').innerHTML = etapas.map(([e, cor], i) => {
      const c = lista.filter(n => n.etapa === e || (i === 0 && !etapas.some(x => x[0] === n.etapa))), t = c.reduce((s, n) => s + Number(n.valor || 0), 0);
      return `<div class="kc" style="border-top-color:${cor}"><div class="kh"><b><i style="background:${cor}"></i>${esc(e)}</b><small>${brl(t)} · ${c.length} negócio${c.length === 1 ? '' : 's'}</small></div>
        <div class="kd" data-e="${esc(e)}" ondragover="event.preventDefault()" ondrop="Funil.solta(event,this.dataset.e)">${c.map(n => `<div class="kk" draggable="true" ondragstart="Funil.arrasta('${n.id}')" onclick="Funil.form('${n.id}')"><b>${esc(n.titulo)}</b><span>${esc(cn(n.cliente_id))}${n.servico ? ' · ' + esc(n.servico) : ''}</span><em>${brl(n.valor)}</em></div>`).join('')}</div>
        <div class="ka" data-e="${esc(e)}" onclick="Funil.form('',this.dataset.e)">+ Novo negócio</div></div>`;
    }).join('');
  }

  async function solta(ev, e) {
    ev.preventDefault(); const n = rows.find(x => x.id === drag); drag = null;
    if (!n || n.etapa === e) return;
    const {error} = await sb.from('negocios').update({etapa: e}).eq('id', n.id);
    if (error) return toast(error.message, 1);
    n.etapa = e;
    if (nome(n) === 'Funil Comercial' && e === 'Aprovado' && confirm('Negócio aprovado! Criar o acompanhamento no funil Pós-Venda?')) {
      const {id, criado_em, ...c} = n;
      const {data} = await sb.from('negocios').insert({...c, funil: 'Pós-Venda', etapa: 'Aguardando Viagem'}).select().single();
      if (data) rows.unshift(data); toast('Card criado no Pós-Venda. Registre a venda em Vendas.');
    }
    desenha();
  }

  function opts(f, sel) { return FUNIS[f].map(([e]) => `<option ${e === sel ? 'selected' : ''}>${e}</option>`).join(''); }
  function trocaFunilForm() { $('n_etapa').innerHTML = opts($('n_funil').value); }

  function form(id, etapa) {
    const n = rows.find(x => x.id === id) || {}, f = n.funil || funil;
    $('dt').textContent = id ? 'Editar negócio' : 'Novo negócio';
    $('db').innerHTML = `<div class="w"><label>Cliente</label><select id="n_cli"><option value="">— Selecionar —</option>${clientes.map(c => `<option value="${c.id}" ${c.id === n.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="w"><label>Título *</label><input id="n_tit" value="${esc(n.titulo || '')}"></div>
      <div><label>Funil</label><select id="n_funil" onchange="Funil.trocaForm()">${Object.keys(FUNIS).map(x => `<option ${x === f ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div><label>Etapa</label><select id="n_etapa">${opts(f, etapa || n.etapa)}</select></div>
      <div><label>Serviço</label><select id="n_serv"><option value="">— Selecionar —</option>${SERV.map(s => `<option ${s === n.servico ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label>Valor (R$)</label><input id="n_val" type="number" step="any" value="${n.valor ?? 0}"></div>
      <div><label>Origem do lead</label><input id="n_ori" value="${esc(n.origem || '')}"></div><div><label>Campanha</label><input id="n_cam" value="${esc(n.campanha || '')}"></div>
      <div class="w"><label>Descrição</label><textarea id="n_des" rows="2">${esc(n.descricao || '')}</textarea></div>`;
    $('df').innerHTML = `${id && me.role === 'admin' ? `<button class="btn bad" onclick="Funil.del('${id}')">Excluir</button>` : ''}<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Funil.save('${id || ''}')">Salvar</button>`;
    $('dlg').showModal();
  }
  async function save(id) {
    const titulo = $('n_tit').value.trim(); if (!titulo) return toast('Informe o título.', 1);
    const row = {titulo, cliente_id: $('n_cli').value || null, funil: $('n_funil').value, etapa: $('n_etapa').value, servico: $('n_serv').value || null, valor: parseFloat($('n_val').value) || 0, origem: $('n_ori').value || null, campanha: $('n_cam').value || null, descricao: $('n_des').value || null};
    const {error} = await (id ? sb.from('negocios').update(row).eq('id', id) : sb.from('negocios').insert(row));
    if (error) return toast(error.message, 1);
    $('dlg').close(); toast('Salvo.'); run();
  }
  async function del(id) { if (!confirm('Excluir este negócio?')) return; const {error} = await sb.from('negocios').delete().eq('id', id); if (error) return toast(error.message, 1); $('dlg').close(); run(); }

  window.Funil = {troca, setMes, desenha, arrasta: id => { drag = id; }, solta, form, trocaForm: trocaFunilForm, save, del};
  window.EXTRA = Object.assign(window.EXTRA || {}, {negocios: {l: 'CRM', run}});
})();
