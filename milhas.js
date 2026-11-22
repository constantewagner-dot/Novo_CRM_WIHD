// WIHD CRM - Módulo Milhas (usa globais do index.html: sb, $, esc, brl, dt, cn, ENT, CLI, list, form)
(function () {
  const TABS = [['contas','Central de contas'],['cartoes','Cartões'],['transf','Transferência'],['mov','Movimentações'],['agend','Agendamentos'],['clubes','Clubes'],['sugc','Sugerir conta'],['emissoes','Emissões'],['sug','Sugestor de compras'],['vf','Viaje Fácil']];
  const PROG = ['Smiles','LATAM Pass','TudoAzul','Livelo','Esfera','Azul Fidelidade','TAP Miles&Go','UAU Caixa','Sicoob','Coopera','Ailos','XP','BV','Outro'];
  const SAIDA = ['emissao','venda','expiracao'];
  let contas = [], tab = 'contas', CPM = 0.025, tmode = 'bonus', pend = 0, movMes = hojeISO().slice(0, 7), movCli = '';
  const somaMes = (m, i) => { const [y, mo] = m.split('-').map(Number), d = new Date(y, mo - 1 + i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const fm = n => Number(n || 0).toLocaleString('pt-BR');
  const cl = id => { const c = contas.find(x => x.id === id); return c ? `${cn(c.cliente_id)} · ${c.programa}` : '—'; };
  const g = id => parseFloat($(id).value) || 0;
  const contaOpts = () => '<option value="">— Selecionar —</option>' + contas.map(c => `<option value="${c.id}">${esc(cn(c.cliente_id))} · ${esc(c.programa)} (${fm(c.saldo)})</option>`).join('');
  const selOpts = a => a.map(o => `<option>${o}</option>`).join('');

  function defs() {
    Object.assign(ENT, {
      contas: {l:'Contas', tb:'milhas_contas', order:'criado_em', f:[CLI,{k:'programa',l:'Programa',t:'sel',o:PROG},{k:'login',l:'Login / nº fidelidade'},{k:'saldo',l:'Saldo (milhas)',t:'number'},{k:'custo_milheiro',l:'Custo do milheiro (R$)',t:'number'},{k:'observacoes',l:'Observações',t:'area',w:1}], cols:['cliente_id','programa','login','saldo','custo_milheiro']},
      cartoes: {l:'Cartões', tb:'milhas_cartoes', order:'criado_em', f:[CLI,{k:'banco',l:'Banco'},{k:'nome',l:'Nome do cartão'},{k:'bandeira',l:'Bandeira',t:'sel',o:['Visa','Mastercard','American Express','Elo','Hipercard','Diners Club']},{k:'final',l:'Final (4 dígitos)'},{k:'limite',l:'Limite (R$)',t:'number'},{k:'pontos_por_real',l:'Pontos por real',t:'number'},{k:'programa',l:'Programa',t:'sel',o:PROG}], cols:['cliente_id','banco','nome','bandeira','final','limite','programa']},
      clubes: {l:'Clubes', tb:'milhas_clubes', order:'criado_em', f:[CLI,{k:'clube',l:'Clube'},{k:'programa',l:'Programa',t:'sel',o:PROG},{k:'milhas_mensais',l:'Milhas por mês',t:'number'},{k:'valor_mensal',l:'Valor mensal (R$)',t:'number'},{k:'renovacao',l:'Próxima renovação',t:'date'}], cols:['cliente_id','clube','programa','milhas_mensais','valor_mensal','renovacao']},
      emissoes: {l:'Emissões', tb:'milhas_emissoes', order:'data', f:[CLI,{k:'programa',l:'Programa',t:'sel',o:PROG},{k:'data',l:'Data',t:'date'},{k:'localizador',l:'Localizador'},{k:'origem',l:'Origem'},{k:'destino',l:'Destino'},{k:'milhas',l:'Milhas utilizadas',t:'number',req:1},{k:'taxas',l:'Taxas (R$)',t:'number'},{k:'valor_mercado',l:'Valor de mercado (R$)',t:'number',req:1},{k:'custo_milha',l:'Custo da milha (vazio = padrão)',t:'number'},{k:'observacoes',l:'Observações',t:'area',w:1}], cols:['data','cliente_id','programa','origem','destino','milhas','taxas','valor_mercado']}
    });
    ['contas','cartoes','clubes','emissoes'].forEach(k => ENT[k].box = 'lbox');
  }

  async function loadContas() { const {data} = await sb.from('milhas_contas').select('*').order('programa'); contas = data || []; }

  async function run() {
    defs();
    const pc = await sb.from('milhas_movimentos').select('*', {count: 'exact', head: true}).eq('agendado', true); pend = pc.count || 0;
    const r = await sb.from('config_app').select('valor_milha').maybeSingle();
    CPM = Number(r.data?.valor_milha) || 0.025;
    $('view').innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap">${TABS.map(([k,l]) => `<button class="btn sm ${k === tab ? 'gold' : 'sec'}" onclick="Milhas.tab('${k}')">${k === 'agend' && pend ? l + ' (' + pend + ')' : l}</button>`).join('')}</div><div id="mbox" style="margin-top:14px"></div>`;
    await show();
  }
  function setTab(k) { tab = k; run(); }

  async function show() {
    await loadContas();
    const b = $('mbox');
    if (['contas','cartoes','clubes','emissoes'].includes(tab)) {
      let info = '';
      if (tab === 'contas') { const t = contas.reduce((s, c) => s + Number(c.saldo || 0), 0); info = `${fm(t)} milhas · valor estimado ${brl(t * CPM)}`; }
      if (tab === 'emissoes') {
        const {data} = await sb.from('milhas_emissoes').select('*');
        let eco = 0, mer = 0, mi = 0, tx = 0;
        (data || []).forEach(e => { const c = e.custo_milha ?? CPM; eco += Number(e.valor_mercado) - (Number(e.taxas) + Number(e.milhas) * c); mer += Number(e.valor_mercado); mi += Number(e.milhas); tx += Number(e.taxas); });
        info = `Economia total ${brl(eco)} · valor médio do milheiro ${mi ? brl((mer - tx) / mi * 1000) : '—'}`;
      }
      b.innerHTML = `<div class="bar"><button class="btn gold" onclick="abrirForm('${tab}')">+ Novo</button><span style="align-self:center;color:var(--mut)">${info}</span></div><div id="lbox"></div>`;
      return list(tab);
    }
    if (tab === 'mov') return mov();
    if (tab === 'agend') return agend();
    if (tab === 'sugc') return sugcView();
    if (tab === 'transf') return transfView();
    if (tab === 'sug') return sugView();
    if (tab === 'vf') return vfView();
  }

  // ===== Movimentações efetivadas =====
  async function mov() {
    const {data} = await sb.from('milhas_movimentos').select('*').eq('agendado', false).gte('data', movMes + '-01').lt('data', somaMes(movMes, 1) + '-01').order('data', {ascending: false}).limit(500);
    const L = (data || []).filter(m => !movCli || contas.find(c => c.id === m.conta_id)?.cliente_id === movCli);
    const ent = L.filter(m => m.quantidade > 0), sai = L.filter(m => m.quantidade < 0), pago = L.reduce((s, m) => s + Number(m.custo || 0), 0);
    const entPaga = ent.filter(m => Number(m.custo) > 0).reduce((s, m) => s + Number(m.quantidade), 0), tit = [...new Set(contas.map(c => c.cliente_id))];
    const kp = (l, v, cor) => `<div class="kpi"><small>${l}</small><b style="color:${cor || 'inherit'}">${v}</b></div>`;
    $('mbox').innerHTML = `<div class="kpis">${kp('Entraram', '+' + fm(ent.reduce((s, m) => s + Number(m.quantidade), 0)), 'var(--ok)')}${kp('Saíram', fm(-sai.reduce((s, m) => s + Number(m.quantidade), 0)), 'var(--bad)')}${kp('Valor pago', brl(pago))}${kp('CPM médio pago', entPaga ? brl(pago / entPaga * 1000) : '—')}</div>
      <div class="bar" style="flex-wrap:wrap"><input type="month" value="${movMes}" onchange="Milhas.mm(this.value)" style="flex:0 0 auto"><select onchange="Milhas.mc(this.value)" style="padding:8px;border:1px solid var(--ln);border-radius:8px"><option value="">Titular: todos</option>${tit.map(t => `<option value="${t}" ${t === movCli ? 'selected' : ''}>${esc(cn(t))}</option>`).join('')}</select><button class="btn gold" onclick="Milhas.movForm(false)">+ Movimentação</button></div>
      <div class="panel"><table><tr><th>Data</th><th>Conta</th><th>Tipo</th><th>Milhas</th><th>Custo</th><th>Descrição</th><th></th></tr>
      ${L.map(m => `<tr><td>${dt(m.data)}</td><td>${esc(cl(m.conta_id))}</td><td>${esc(m.tipo)}</td><td style="color:${m.quantidade < 0 ? 'var(--bad)' : 'var(--ok)'}">${fm(m.quantidade)}</td><td>${brl(m.custo)}</td><td>${esc(m.descricao || '')}</td><td>${me.role === 'admin' ? `<button class="btn sm bad" onclick="Milhas.delMov('${m.id}')">Excluir</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7">Nenhuma movimentação neste período.</td></tr>'}</table></div>`;
  }

  // ===== Agendamentos e confirmações pendentes =====
  async function agend() {
    const {data} = await sb.from('milhas_movimentos').select('*').eq('agendado', true).order('data'), L = data || [], h = hojeISO();
    const kp = (l, v, cor) => `<div class="kpi"><small>${l}</small><b style="color:${cor || 'inherit'}">${v}</b></div>`;
    $('mbox').innerHTML = `<div class="kpis">${kp('Pendentes', L.length)}${kp('Milhas a creditar', '+' + fm(L.filter(m => m.quantidade > 0).reduce((s, m) => s + Number(m.quantidade), 0)), 'var(--ok)')}${kp('Atrasados', L.filter(m => m.data < h).length, L.some(m => m.data < h) ? 'var(--bad)' : 'var(--ok)')}</div>
      <div class="bar"><button class="btn gold" onclick="Milhas.movForm(true)">+ Agendar</button><span style="align-self:center;color:var(--mut)">Confirme quando os pontos realmente caírem. Só então o saldo da conta é atualizado.</span></div>
      <div class="panel"><table><tr><th>Data</th><th>Conta</th><th>Tipo</th><th>Milhas</th><th>Situação</th><th>Descrição</th><th></th></tr>
      ${L.map(m => `<tr><td>${dt(m.data)}</td><td>${esc(cl(m.conta_id))}</td><td>${esc(m.tipo)}</td><td style="color:${m.quantidade < 0 ? 'var(--bad)' : 'var(--ok)'}">${fm(m.quantidade)}</td>
      <td>${m.data < h ? '<span class="tag" style="background:var(--badbg);color:var(--bad)">Atrasado</span>' : m.data === h ? '<span class="tag">Hoje</span>' : '<span class="tag">Futuro</span>'}</td><td>${esc(m.descricao || '')}</td>
      <td><button class="btn sm gold" onclick="Milhas.efetivar('${m.id}')">Confirmar</button> ${me.role === 'admin' ? `<button class="btn sm bad" onclick="Milhas.delMov('${m.id}')">Cancelar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7">Nenhum agendamento pendente.</td></tr>'}</table></div>`;
  }
  async function despesa(valor, desc, data) {
    if (!(valor > 0)) return;
    const {error} = await sb.from('transacoes').insert({tipo: 'despesa', categoria: 'Compra de milhas', descricao: desc, valor, vencimento: data, data, pago: true, pago_em: data});
    if (error) toast('Milhas salvas, mas o financeiro recusou o lançamento: ' + error.message, 1);
  }

  function movForm(ag) {
    $('dt').textContent = ag ? 'Agendar movimentação' : 'Nova movimentação';
    $('db').innerHTML = `<div class="w"><label>Conta *</label><select id="m_conta">${contaOpts()}</select></div>
      <div><label>Tipo</label><select id="m_tipo">${selOpts(['compra','bonus','emissao','venda','expiracao'])}</select></div>
      <div><label>Quantidade de milhas *</label><input id="m_qtd" type="number" min="1"></div>
      <div><label>Custo (R$)</label><input id="m_custo" type="number" step="any" value="0"></div>
      <div><label>${ag ? 'Data agendada' : 'Data'}</label><input id="m_data" type="date" value="${hojeISO()}"></div>
      <div class="w"><label>Descrição</label><input id="m_desc"></div><div class="w"><label><input type="checkbox" id="m_fin" style="width:auto"> Registrar o custo como despesa no financeiro</label></div>`;
    $('df').innerHTML = `<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Milhas.saveMov(${ag})">Salvar</button>`;
    $('dlg').showModal();
  }
  async function saveMov(ag) {
    const q = Math.abs(parseInt($('m_qtd').value)), conta = $('m_conta').value, tipo = $('m_tipo').value;
    if (!conta || !q) return toast('Escolha a conta e a quantidade.', 1);
    const {error} = await sb.from('milhas_movimentos').insert({conta_id:conta, tipo, quantidade:SAIDA.includes(tipo) ? -q : q, custo:g('m_custo'), data:$('m_data').value, descricao:$('m_desc').value || null, agendado:ag});
    if (error) return toast(error.message, 1);
    if ($('m_fin')?.checked) await despesa(g('m_custo'), $('m_desc').value || 'Compra de milhas · ' + cl(conta), $('m_data').value);
    $('dlg').close(); toast(ag ? 'Agendado.' : 'Saldo atualizado.'); show();
  }
  async function efetivar(id) { const {error} = await sb.from('milhas_movimentos').update({agendado:false}).eq('id', id); toast(error ? error.message : 'Efetivado. Saldo atualizado.', !!error); show(); }
  async function delMov(id) { if (!confirm('Excluir? Se estiver efetivada, o saldo será revertido.')) return; const {error} = await sb.from('milhas_movimentos').delete().eq('id', id); toast(error ? error.message : 'Excluído.', !!error); show(); }

  // ===== Transferência bonificada / adicionar milhas =====
  function transfView() {
    $('mbox').innerHTML = `<div style="display:flex;gap:6px;margin-bottom:10px"><button class="btn sm ${tmode === 'bonus' ? 'gold' : 'sec'}" onclick="Milhas.tmode('bonus')">Transferência bonificada</button><button class="btn sm ${tmode === 'add' ? 'gold' : 'sec'}" onclick="Milhas.tmode('add')">Adicionar milhas</button></div>
    <div class="panel" style="padding:16px;max-width:760px">${tmode === 'add' ? `<p style="margin-top:0;color:var(--mut)">Lance milhas direto em uma conta (compra, bônus, ajuste), com custo e registro opcional no financeiro.</p><button class="btn gold" onclick="Milhas.movForm(false)">Lançar milhas</button>` :
    `<p style="margin-top:0;color:var(--mut)">Converta pontos em milhas aplicando paridade e bônus em uma ou mais contas.</p><div class="mb" style="padding:0;max-height:none" oninput="Milhas.prevT()">
      <div class="w"><label>Conta de origem (pontos)</label><select id="t_o" onchange="Milhas.prevT()">${contaOpts()}</select></div>
      <div><label>Paridade (milhas por ponto)</label><input id="t_par" type="number" step="any" value="1"></div><div><label>Bônus (%)</label><input id="t_b" type="number" step="any" value="0"></div>
      <div class="w"><label>Contas de destino e pontos de cada uma</label><div id="t_dest"></div><button class="btn sm sec" type="button" onclick="Milhas.addDest()">+ outra conta de destino</button></div>
      <div><label>Custo da compra dos pontos (R$) — opcional</label><input id="t_custo" type="number" step="any" value="0"></div><div><label>Data</label><input id="t_data" type="date" value="${hojeISO()}"></div>
      <div class="w"><label><input type="checkbox" id="t_fin" checked style="width:auto"> Registrar esta compra como despesa no financeiro</label></div>
      <div class="w"><label><input type="checkbox" id="t_conf" checked style="width:auto"> Exigir confirmação da queda dos pontos (as milhas só entram no saldo depois de confirmadas em Agendamentos)</label></div>
      <div class="w"><label>Descrição (opcional)</label><input id="t_desc"></div><div class="w" id="t_prev" style="background:var(--soft);border-radius:8px;padding:10px"></div>
      <div class="w"><button class="btn gold" onclick="Milhas.saveTransf()">Transferir</button></div></div>`}</div>`;
    if (tmode === 'bonus') { addDest(); prevT(); }
  }
  function addDest() {
    const d = document.createElement('div'); d.className = 'drow'; d.style.cssText = 'display:flex;gap:8px;margin-bottom:6px';
    d.innerHTML = `<select class="d_c" style="flex:2">${contaOpts()}</select><input class="d_q" type="number" placeholder="Pontos" style="flex:1">`; $('t_dest').appendChild(d);
  }
  const destinos = () => [...document.querySelectorAll('#t_dest .drow')].map(r => ({c: r.querySelector('.d_c').value, q: Math.abs(parseInt(r.querySelector('.d_q').value) || 0)})).filter(x => x.c && x.q);
  function prevT() {
    if (!$('t_prev')) return;
    const tot = destinos().reduce((s, x) => s + x.q, 0), par = g('t_par') || 1, b = g('t_b'), cred = Math.round(tot * par * (1 + b / 100)), custo = g('t_custo'), o = contas.find(c => c.id === $('t_o').value);
    $('t_prev').innerHTML = `Sai da origem <b>${fm(tot)}</b> pontos${o ? ` (saldo ${fm(o.saldo)})` : ''} · Entram <b>${fm(cred)}</b> milhas${custo > 0 && cred ? ` · CPM <b>${brl(custo / cred * 1000)}</b>` : ''}`;
  }
  async function saveTransf() {
    const o = $('t_o').value, par = g('t_par') || 1, b = g('t_b'), data = $('t_data').value, conf = $('t_conf').checked, custo = g('t_custo'), dest = destinos();
    if (!o || !dest.length) return toast('Escolha a conta de origem e ao menos uma conta de destino com pontos.', 1);
    if (dest.some(x => x.c === o)) return toast('A origem não pode ser também destino.', 1);
    const tot = dest.reduce((s, x) => s + x.q, 0), co = contas.find(c => c.id === o);
    if (Number(co.saldo) < tot) return toast('Saldo insuficiente na conta de origem.', 1);
    const desc = $('t_desc').value || 'Transferência de ' + cl(o);
    const rows = [{conta_id: o, tipo: 'transferencia', quantidade: -tot, data, agendado: false, bonus_pct: b, descricao: desc}].concat(dest.map(x => ({conta_id: x.c, tipo: 'transferencia', quantidade: Math.round(x.q * par * (1 + b / 100)),
      custo: custo ? Math.round(custo * x.q / tot * 100) / 100 : 0, bonus_pct: b, data, agendado: conf, descricao: desc})));
    const {error} = await sb.from('milhas_movimentos').insert(rows);
    if (error) return toast(error.message, 1);
    if ($('t_fin').checked) await despesa(custo, desc, data);
    toast(conf ? 'Transferência registrada. Confirme a queda dos pontos em Agendamentos.' : 'Transferência concluída.'); tab = conf ? 'agend' : 'mov'; run();
  }

  // ===== Sugestor de compras =====
  function sugView() {
    $('mbox').innerHTML = `<div class="panel" style="padding:16px"><p style="margin-top:0;color:var(--mut)">Informe a emissão desejada e a oferta de compra de milhas. O sistema diz se compensa.</p><div class="mb" style="padding:0" oninput="Milhas.calcSug()">
      <div><label>Milhas necessárias</label><input id="s_need" type="number"></div><div><label>Saldo atual</label><input id="s_have" type="number" value="0"></div>
      <div><label>Preço do milheiro na oferta (R$)</label><input id="s_preco" type="number" step="any"></div><div><label>Bônus da oferta (%)</label><input id="s_bonus" type="number" value="0"></div>
      <div><label>Valor da passagem em dinheiro (R$)</label><input id="s_merc" type="number" step="any"></div><div><label>Taxas na emissão (R$)</label><input id="s_tx" type="number" step="any" value="0"></div></div>
      <div id="s_out" style="margin-top:14px"></div></div>`;
  }
  function calcSug() {
    const need = g('s_need'), have = g('s_have'), preco = g('s_preco'), bonus = g('s_bonus'), merc = g('s_merc'), tx = g('s_tx');
    if (!need || !preco || !merc) return $('s_out').innerHTML = '';
    const comprar = Math.max(0, need - have) / (1 + bonus / 100), custo = comprar / 1000 * preco, real = preco / (1 + bonus / 100);
    const total = custo + tx, eco = merc - total, obtido = (merc - tx) / need * 1000, ok = eco > 0 && real < obtido;
    $('s_out').innerHTML = `<div class="kpis"><div class="kpi"><small>Milhas a comprar</small><b>${fm(Math.ceil(comprar))}</b></div><div class="kpi"><small>Custo real do milheiro</small><b>${brl(real)}</b></div>
      <div class="kpi"><small>Custo total (com taxas)</small><b>${brl(total)}</b></div><div class="kpi"><small>Economia</small><b style="color:${eco > 0 ? 'var(--ok)' : 'var(--bad)'}">${brl(eco)}</b></div></div>
      <p><b>${ok ? 'Compensa comprar e emitir.' : 'Não compensa nesta oferta.'}</b> Cada milheiro emitido rende ${brl(obtido)} em passagem; a oferta custa ${brl(real)}. Seu valor de referência é ${brl(CPM * 1000)} por milheiro.</p>`;
  }

  // ===== Sugerir conta =====
  function sugcView() {
    $('mbox').innerHTML = `<div class="panel" style="padding:16px"><p style="margin-top:0;color:var(--mut)">Informe o programa e as milhas da emissão. O sistema ordena as contas que podem emitir.</p>
      <div class="mb" style="padding:0;max-height:none" oninput="Milhas.calcSugc()" onchange="Milhas.calcSugc()"><div><label>Programa</label><select id="c_prog"><option value="">— Selecionar —</option>${selOpts(PROG)}</select></div>
      <div><label>Milhas necessárias</label><input id="c_need" type="number"></div><div class="w"><label>Cliente da emissão (opcional, prioriza a conta dele)</label><select id="c_cli"><option value="">—</option>${clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div></div><div id="c_out" style="margin-top:14px"></div></div>`;
  }
  function calcSugc() {
    const p = $('c_prog').value, need = g('c_need'), cli = $('c_cli').value; if (!p || !need) return $('c_out').innerHTML = '';
    const cs = contas.filter(c => c.programa === p).map(c => ({...c, cobre: Number(c.saldo) >= need, propria: !!cli && c.cliente_id === cli}))
      .sort((a, b) => (b.cobre - a.cobre) || (b.propria - a.propria) || (Number(a.custo_milheiro || 0) - Number(b.custo_milheiro || 0)) || (b.saldo - a.saldo));
    if (!cs.length) return $('c_out').innerHTML = '<p>Nenhuma conta cadastrada neste programa.</p>';
    let aviso = '';
    if (!cs.some(c => c.cobre)) { let acc = 0; const comb = []; [...cs].sort((a, b) => b.saldo - a.saldo).forEach(c => { if (acc < need) { comb.push(c); acc += Number(c.saldo); } });
      aviso = acc >= need ? `<p><b>Nenhuma conta cobre sozinha.</b> Combinação sugerida: ${comb.map(c => `${esc(cn(c.cliente_id))} (${fm(c.saldo)})`).join(' + ')}.</p>` : `<p><b>O saldo total do programa não cobre a emissão.</b> Faltam ${fm(need - acc)} milhas.</p>`; }
    $('c_out').innerHTML = aviso + `<div class="panel"><table><tr><th>#</th><th>Titular</th><th>Saldo</th><th>Custo do milheiro</th><th>Custo da emissão</th><th>Saldo após</th><th>Situação</th></tr>
      ${cs.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(cn(c.cliente_id))}${c.propria ? ' <span class="tag">conta do cliente</span>' : ''}</td><td>${fm(c.saldo)}</td><td>${brl(c.custo_milheiro)}</td><td>${brl(need / 1000 * Number(c.custo_milheiro || 0))}</td><td>${c.cobre ? fm(c.saldo - need) : '—'}</td>
      <td>${c.cobre ? `<span class="tag">${i === 0 ? 'Recomendada' : 'Cobre'}</span>` : 'Faltam ' + fm(need - c.saldo)}</td></tr>`).join('')}</table></div><p style="color:var(--mut)">Ordem: contas que cobrem a emissão primeiro, depois a do próprio cliente, depois o menor custo do milheiro.</p>`;
  }

  // ===== Viaje Fácil =====
  function vfView() {
    $('mbox').innerHTML = `<div class="panel" style="padding:16px"><p style="margin-top:0;color:var(--mut)">Compare pagar em dinheiro ou emitir com milhas, e veja qual conta do cliente pode emitir.</p><div class="mb" style="padding:0" oninput="Milhas.calcVf()" onchange="Milhas.calcVf()">
      <div class="w"><label>Cliente</label><select id="v_cli"><option value="">— Selecionar —</option>${clientes.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
      <div><label>Passagem em dinheiro (R$)</label><input id="v_merc" type="number" step="any"></div><div><label>Taxas com milhas (R$)</label><input id="v_tx" type="number" step="any" value="0"></div>
      <div class="w"><label>Milhas necessárias</label><input id="v_need" type="number"></div></div><div id="v_out" style="margin-top:14px"></div></div>`;
  }
  function calcVf() {
    const merc = g('v_merc'), tx = g('v_tx'), need = g('v_need'), cli = $('v_cli').value;
    if (!merc || !need) return $('v_out').innerHTML = '';
    const val = (merc - tx) / need * 1000, base = CPM * 1000, usar = val >= base;
    const cs = contas.filter(c => c.cliente_id === cli).sort((a, b) => b.saldo - a.saldo);
    $('v_out').innerHTML = `<p><b>${usar ? 'Vale usar milhas.' : 'Melhor pagar em dinheiro.'}</b> Cada milheiro vale ${brl(val)} nesta emissão (referência ${brl(base)}). Pagando com milhas você desembolsa ${brl(tx)} de taxas e evita ${brl(merc)}.</p>
      ${cli ? `<div class="panel"><table><tr><th>Conta</th><th>Saldo</th><th>Situação</th></tr>${cs.map(c => `<tr><td>${esc(c.programa)}</td><td>${fm(c.saldo)}</td><td>${c.saldo >= need ? '<span class="tag">Saldo suficiente</span>' : 'Faltam ' + fm(need - c.saldo)}</td></tr>`).join('') || '<tr><td colspan="3">Cliente sem contas de milhas.</td></tr>'}</table></div>` : ''}`;
  }

  window.Milhas = {run, tab:setTab, movForm, saveMov, efetivar, delMov, saveTransf, calcSug, calcVf, tmode: k => { tmode = k; show(); }, addDest, prevT, calcSugc, mm: v => { movMes = v || movMes; show(); }, mc: v => { movCli = v; show(); }};
  window.EXTRA = Object.assign(window.EXTRA || {}, {milhas:{l:'Milhas', run}});
})();
