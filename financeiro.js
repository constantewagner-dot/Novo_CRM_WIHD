// WIHD CRM - Financeiro: contas a receber, contas a pagar e comissões
(function () {
  let tab = 'resumo', perfis = [], cache = [], showPagos = false;
  const hoje = () => hojeISO();
  const pode = () => ['admin', 'financeiro'].includes(me.role);
  const pn = id => perfis.find(p => p.id === id)?.nome || '—';
  const venc = t => t.vencimento || t.data;
  const sit = t => t.pago ? `<span class="tag">${t.tipo === 'receita' ? 'Recebido' : 'Pago'}</span>`
    : venc(t) < hoje() ? '<span class="tag" style="background:var(--badbg);color:var(--bad)">Vencido</span>' : '<span class="tag">A vencer</span>';
  const soma = a => a.reduce((s, x) => s + Number(x.valor || 0), 0);
  const tabs = () => pode() ? [['resumo', 'Visão geral'], ['fluxo', 'Fluxo de caixa'], ['lanc', 'Lançamentos'], ['receber', 'A receber'], ['pagar', 'A pagar'], ['contas', 'Contas'], ['faturas', 'Faturas'], ['comissoes', 'Comissões'], ['folha', 'Folha']] : [['comissoes', 'Minhas comissões']];
  const addMes = (s, i) => {
    const d = new Date(s + 'T00:00:00'), dia = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + i);
    d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  async function run() {
    if (!pode()) tab = 'comissoes';
    const {data} = await sb.from('profiles').select('id,nome,role,comissao_pct').order('nome'); perfis = data || []; await carregarFin();
    $('view').innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap">${tabs().map(([k, l]) => `<button class="btn sm ${k === tab ? 'gold' : 'sec'}" onclick="Fin.tab('${k}')">${l}</button>`).join('')}</div><div id="fbox" style="margin-top:14px"></div>`;
    show();
  }
  function show() { const b = $('fbox'); return tab === 'resumo' ? visao(b) : tab === 'fluxo' ? fluxo(b) : tab === 'lanc' ? lanc(b) : tab === 'folha' ? folha(b) : tab === 'contas' ? ctasView(b) : tab === 'faturas' ? faturas(b) : tab === 'comissoes' ? comissoes(b) : contas(b, tab === 'receber' ? 'receita' : 'despesa'); }

  async function resumo(b) {
    const [t, c] = await Promise.all([sb.from('transacoes').select('tipo,valor,pago,vencimento,data,pago_em'), sb.from('comissoes').select('valor').eq('status', 'pendente')]);
    const T = t.data || [], mes = hoje().slice(0, 7), ab = T.filter(x => !x.pago);
    const rec = ab.filter(x => x.tipo === 'receita'), pag = ab.filter(x => x.tipo === 'despesa'), com = soma(c.data || []);
    const vencidos = a => a.filter(x => venc(x) < hoje());
    const noMes = tipo => soma(T.filter(x => x.pago && x.tipo === tipo && (x.pago_em || x.data || '').startsWith(mes)));
    const k = (l, v, cor) => `<div class="kpi"><small>${l}</small><b${cor ? ` style="color:${cor}"` : ''}>${brl(v)}</b></div>`;
    b.innerHTML = `<div class="kpis">${k('A receber', soma(rec))}${k('Vencido a receber', soma(vencidos(rec)), soma(vencidos(rec)) ? 'var(--bad)' : '')}
      ${k('A pagar', soma(pag))}${k('Vencido a pagar', soma(vencidos(pag)), soma(vencidos(pag)) ? 'var(--bad)' : '')}
      ${k('Comissões de vendedores a pagar', com)}${k('Saldo previsto', soma(rec) - soma(pag) - com, soma(rec) - soma(pag) - com >= 0 ? 'var(--ok)' : 'var(--bad)')}
      ${k('Recebido no mês', noMes('receita'))}${k('Pago no mês', noMes('despesa'))}</div>
      <p style="color:var(--mut)">Saldo previsto = a receber − a pagar − comissões de vendedores pendentes.</p>`;
  }

  async function contas(b, tipo) {
    const {data} = await sb.from('transacoes').select('*').eq('tipo', tipo).order('vencimento', {ascending: true, nullsFirst: false}).limit(500);
    cache = data || []; const rec = tipo === 'receita', rows = cache.filter(t => showPagos || !t.pago);
    b.innerHTML = `<div class="bar" style="flex-wrap:wrap"><button class="btn gold" onclick="Fin.form('${tipo}')">+ ${rec ? 'Conta a receber' : 'Conta a pagar'}</button>
      ${rec ? '<button class="btn sec" onclick="Fin.parcelar()">Parcelar venda</button>' : ''}
      <label style="align-self:center"><input type="checkbox" ${showPagos ? 'checked' : ''} onchange="Fin.pagos(this.checked)"> mostrar ${rec ? 'recebidos' : 'pagos'}</label>
      <span style="align-self:center;margin-left:auto;color:var(--mut)">Em aberto: <b>${brl(soma(cache.filter(t => !t.pago)))}</b></span></div>
      <div class="panel"><table><tr><th>Vencimento</th><th>${rec ? 'Cliente' : 'Fornecedor'}</th><th>Descrição</th><th>Valor</th><th>Situação</th><th></th></tr>
      ${rows.map(t => `<tr><td>${dt(venc(t))}</td><td>${esc(rec ? cn(t.cliente_id) : t.fornecedor || '—')}</td><td>${esc(t.descricao || t.categoria || '—')}</td><td>${brl(t.valor)}</td><td>${sit(t)}</td>
      <td>${t.pago ? '' : `<button class="btn sm gold" onclick="Fin.baixar('${t.id}')">${rec ? 'Receber' : 'Pagar'}</button>`} <button class="btn sm sec" onclick="Fin.form('${tipo}','${t.id}')">Editar</button> ${me.role === 'admin' ? `<button class="btn sm bad" onclick="Fin.del('${t.id}')">Excluir</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Nada em aberto.</td></tr>'}</table></div>`;
  }
  function pagos(v) { showPagos = v; show(); }
  function baixar(id) { abrirBaixa([id], 'Dar baixa'); }
  async function del(id) { if (!confirm('Excluir este lançamento?')) return; const {error} = await sb.from('transacoes').delete().eq('id', id); toast(error ? error.message : 'Excluído.', !!error); show(); }

  function form(tipo, id, cart) {
    const t = cache.find(x => x.id === id) || {}, rec = tipo === 'receita';
    $('dt').textContent = (id ? 'Editar · ' : 'Nova · ') + (rec ? 'conta a receber' : 'conta a pagar');
    $('db').innerHTML = `<div class="w"><label>Descrição *</label><input id="l_desc" value="${esc(t.descricao || '')}"></div>
      <div><label>Valor (R$) *</label><input id="l_valor" type="number" step="any" value="${t.valor ?? ''}"></div><div><label>Vencimento *</label><input id="l_venc" type="date" value="${t.cartao_id ? t.data : (t.vencimento || hoje())}"></div>
      ${rec ? `<div><label>Cliente</label><select id="l_cli"><option value="">— Selecionar —</option>${clientes.map(c => `<option value="${c.id}" ${c.id === t.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>`
            : `<div><label>Fornecedor</label><input id="l_forn" value="${esc(t.fornecedor || '')}"></div><div><label>Cartão de crédito</label><select id="l_cart"><option value="">— Nenhum —</option>${cartoesFin.filter(c => c.ativo).map(c => `<option value="${c.id}" ${(t.cartao_id || cart) === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select><small style="color:var(--mut)">No cartão, informe a data da compra: o vencimento vem da fatura.</small></div>`}
      <div><label>Categoria</label><input id="l_cat" value="${esc(t.categoria || (rec ? 'Venda' : 'Fornecedor'))}"></div>
      <div><label>${rec ? 'Já recebido?' : 'Já pago?'}</label><select id="l_pago"><option value="false">Não</option><option value="true" ${t.pago ? 'selected' : ''}>Sim</option></select></div>`;
    $('df').innerHTML = `<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Fin.save('${tipo}','${id || ''}')">Salvar</button>`;
    $('dlg').showModal();
  }
  async function save(tipo, id) {
    const valor = parseFloat($('l_valor').value), v = $('l_venc').value, pago = $('l_pago').value === 'true', antes = cache.find(x => x.id === id);
    if (!$('l_desc').value.trim() || !valor || !v) return toast('Preencha descrição, valor e vencimento.', 1);
    const row = {tipo, descricao: $('l_desc').value.trim(), valor, vencimento: v, data: v, categoria: $('l_cat').value || null, pago,
      pago_em: pago ? (antes?.pago_em || hoje()) : null, cliente_id: tipo === 'receita' ? ($('l_cli').value || null) : null, fornecedor: tipo === 'despesa' ? ($('l_forn').value || null) : null};
    if (tipo === 'despesa') { const ct = cartoesFin.find(c => c.id === $('l_cart')?.value); row.cartao_id = ct ? ct.id : null; if (ct) row.vencimento = fatura(v, ct).venc; }
    const {error} = await (id ? sb.from('transacoes').update(row).eq('id', id) : sb.from('transacoes').insert(row));
    if (error) return toast(error.message, 1);
    $('dlg').close(); toast('Salvo.'); show();
  }

  async function parcelar(pre) {
    const {data} = await sb.from('vendas').select('id,cliente_id,valor,destino,data_venda').order('data_venda', {ascending: false}).limit(100);
    window._vp = data || [];
    $('dt').textContent = 'Parcelar venda em contas a receber';
    $('db').innerHTML = `<div class="w"><label>Venda *</label><select id="p_v"><option value="">— Selecionar —</option>${window._vp.map(v => `<option value="${v.id}" ${v.id === pre ? 'selected' : ''}>${esc(cn(v.cliente_id))} · ${esc(v.destino || 'venda')} · ${brl(v.valor)}</option>`).join('')}</select></div>
      <div><label>Número de parcelas</label><input id="p_n" type="number" min="1" max="36" value="1"></div><div><label>Primeiro vencimento</label><input id="p_d" type="date" value="${hoje()}"></div>`;
    $('df').innerHTML = '<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Fin.gerar()">Gerar parcelas</button>';
    $('dlg').showModal();
  }
  async function gerar() {
    const v = window._vp.find(x => x.id === $('p_v').value), n = parseInt($('p_n').value), d0 = $('p_d').value;
    if (!v || !n || n < 1 || !d0) return toast('Escolha a venda, o número de parcelas e o vencimento.', 1);
    const base = Math.floor(Number(v.valor) / n * 100) / 100; let resto = Math.round((Number(v.valor) - base * n) * 100) / 100;
    const rows = Array.from({length: n}, (_, i) => ({tipo: 'receita', categoria: 'Venda', cliente_id: v.cliente_id, venda_id: v.id, descricao: `Parcela ${i + 1}/${n} · ${v.destino || 'venda'}`,
      valor: i === n - 1 ? Math.round((base + resto) * 100) / 100 : base, vencimento: addMes(d0, i), data: addMes(d0, i), pago: false}));
    const {error} = await sb.from('transacoes').insert(rows);
    if (error) return toast(error.message, 1);
    $('dlg').close(); toast(`${n} parcela(s) criada(s) em “A receber”.`); if ($('fbox')) show(); else if (window.Vend) Vend.reload();
  }

  async function comissoes(b) {
    const {data: cs} = await sb.from('comissoes').select('*').order('criado_em', {ascending: false});
    const ids = [...new Set((cs || []).map(c => c.venda_id))];
    const {data: vs} = ids.length ? await sb.from('vendas').select('id,cliente_id,destino,valor').in('id', ids) : {data: []};
    const vm = Object.fromEntries((vs || []).map(v => [v.id, v])), pend = (cs || []).filter(c => c.status === 'pendente');
    b.innerHTML = `<div class="bar" style="flex-wrap:wrap">${pode() ? '<button class="btn gold" onclick="Fin.gerarCom()">Gerar comissões das vendas</button>' : ''}
      <span style="align-self:center;margin-left:auto;color:var(--mut)">A pagar: <b>${brl(soma(pend))}</b></span></div>
      <div class="panel"><table><tr><th>Venda</th><th>Vendedor</th><th>Comissão da agência</th><th>%</th><th>Comissão do vendedor</th><th>Situação</th><th></th></tr>
      ${(cs || []).map(c => { const v = vm[c.venda_id] || {}; return `<tr><td>${esc(cn(v.cliente_id))} · ${esc(v.destino || '—')} · ${brl(v.valor)}</td><td>${esc(pn(c.vendedor_id))}</td><td>${brl(c.base)}</td><td>${c.pct}%</td><td><b>${brl(c.valor)}</b></td>
      <td><span class="tag">${c.status === 'paga' ? 'Paga em ' + dt(c.pago_em) : 'Pendente'}</span></td><td>${pode() && c.status === 'pendente' && c.valor > 0 ? `<button class="btn sm gold" onclick="Fin.pagarCom('${c.id}')">Pagar</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7">Nenhuma comissão. Defina o % dos colaboradores abaixo e clique em “Gerar comissões das vendas”.</td></tr>'}</table></div>
      ${me.role === 'admin' ? `<h3 style="font-size:1.5rem;margin:18px 0 8px">Percentual de cada colaborador</h3><p style="margin:0 0 8px;color:var(--mut)">Percentual que o colaborador recebe sobre a comissão que a agência ganha em cada venda. Vale para comissões geradas daqui para frente.</p>
      <div class="panel"><table><tr><th>Colaborador</th><th>Perfil</th><th>% sobre a comissão da agência</th></tr>${perfis.map(p => `<tr><td>${esc(p.nome)}</td><td>${esc(p.role)}</td><td><input type="number" step="any" value="${p.comissao_pct || 0}" style="width:90px;padding:6px;border:1px solid var(--ln);border-radius:8px" onchange="Fin.setPct('${p.id}',this.value)"></td></tr>`).join('')}</table></div>` : ''}`;
  }
  async function gerarCom() { const {data, error} = await sb.rpc('gerar_comissoes'); toast(error ? error.message : `${data} comissão(ões) gerada(s).`, !!error); show(); }
  async function pagarCom(id) { if (!confirm('Pagar esta comissão? A saída será lançada no caixa.')) return; const {error} = await sb.rpc('pagar_comissao', {cid: id}); toast(error ? error.message : 'Comissão paga e lançada no caixa.', !!error); show(); }
  async function setPct(id, v) { const {error} = await sb.from('profiles').update({comissao_pct: parseFloat(v) || 0}).eq('id', id); toast(error ? error.message : 'Percentual atualizado.', !!error); const p = perfis.find(x => x.id === id); if (p) p.comissao_pct = parseFloat(v) || 0; }

  // ===== Visão geral, fluxo de caixa, lançamentos e folha =====
  let mesF = hojeISO().slice(0, 7), regime = 'caixa', folhaRows = [];
  const somaMes = (m, i) => { const [y, mo] = m.split('-').map(Number), d = new Date(y, mo - 1 + i, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const somaF = (a, f) => a.reduce((s, x) => s + Number(f(x) || 0), 0);
  const mmReg = t => (regime === 'caixa' ? (t.pago ? (t.pago_em || t.data) : '') : venc(t)) || '';
  const lucroVenda = (v, pad) => Number(v.valor || 0) - (Number(v.milhas || 0) / 1000 * (v.cpm != null ? Number(v.cpm) : pad) + Number(v.taxas || 0) + Number(v.custo_outros || 0));
  const nav = (reg) => `<div class="bar" style="flex-wrap:wrap"><input type="month" value="${mesF}" onchange="Fin.mes(this.value)" style="flex:0 0 auto">${reg ? `<button class="btn sm ${regime === 'caixa' ? 'gold' : 'sec'}" title="Considera quando o dinheiro entrou ou saiu" onclick="Fin.reg('caixa')">Caixa</button><button class="btn sm ${regime === 'comp' ? 'gold' : 'sec'}" title="Considera a data prevista (vencimento)" onclick="Fin.reg('comp')">Competência</button>` : ''}</div>`;
  const barras = (a, cor) => { const g = {}; a.forEach(x => { const c = x.categoria || 'Sem categoria'; g[c] = (g[c] || 0) + Number(x.valor || 0); }); const mx = Math.max(1, ...Object.values(g));
    return Object.entries(g).sort((x, y) => y[1] - x[1]).map(([c, v]) => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="flex:0 0 140px;font-size:.9rem">${esc(c)}</span><div style="flex:1;background:var(--ln);border-radius:4px"><div style="width:${v / mx * 100}%;background:${cor};height:14px;border-radius:4px"></div></div><b style="flex:0 0 110px;text-align:right">${brl(v)}</b></div>`).join('') || '<p style="color:var(--mut)">Nada no período.</p>'; };

  async function visao(b) {
    const [t, v, k, c] = await Promise.all([sb.from('transacoes').select('tipo,categoria,valor,pago,pago_em,vencimento,data').limit(5000),
      sb.from('vendas').select('id,valor,milhas,cpm,taxas,custo_outros').gte('data_venda', mesF + '-01').lt('data_venda', somaMes(mesF, 1) + '-01'),
      sb.from('comissoes').select('venda_id,valor'), sb.from('config_app').select('valor_milha').maybeSingle()]);
    const T = (t.data || []).filter(x => mmReg(x).startsWith(mesF)), rec = T.filter(x => x.tipo === 'receita'), des = T.filter(x => x.tipo === 'despesa');
    const pad = (Number(c.data?.valor_milha) || 0.025) * 1000, V = v.data || [], ids = new Set(V.map(x => x.id));
    const lv = somaF(V, x => lucroVenda(x, pad)), ce = somaF((k.data || []).filter(x => ids.has(x.venda_id)), x => x.valor);
    const op = des.filter(x => x.categoria !== 'Comissão vendedor'), dop = soma(op), ll = lv - ce - dop;
    const kp = (l, val, s, cor) => `<div class="kpi"><small>${l}</small><b${cor ? ` style="color:${cor}"` : ''}>${brl(val)}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    b.innerHTML = `${nav(true)}<h3 style="font-size:1.4rem;margin:6px 0">Lançamentos do período</h3><div class="kpis">${kp('Receitas', soma(rec), '', 'var(--ok)')}${kp('Despesas', soma(des), '', 'var(--bad)')}${kp('Saldo do período', soma(rec) - soma(des), '', soma(rec) >= soma(des) ? 'var(--ok)' : 'var(--bad)')}</div>
      <h3 style="font-size:1.4rem;margin:6px 0">Resultado do período</h3><div class="kpis">${kp('Lucro das vendas', lv, 'emissões do período')}${kp('Comissão da equipe', ce, 'das vendas do período')}${kp('Despesas operacionais', dop, 'folha, impostos, custos fixos')}${kp('Lucro líquido', ll, 'o que sobrou da operação', ll >= 0 ? 'var(--ok)' : 'var(--bad)')}</div>
      <p style="color:var(--mut)">Lucro líquido = lucro das vendas − comissões da equipe − despesas operacionais (as comissões pagas não entram duas vezes). ${regime === 'caixa' ? 'Regime de caixa: conta só o que já foi pago ou recebido no mês.' : 'Regime de competência: conta pela data de vencimento, pago ou não.'}</p>
      <div class="panel" style="padding:14px;margin-bottom:12px"><b>Despesas por categoria</b>${barras(des, 'var(--bad)')}</div><div class="panel" style="padding:14px"><b>Receitas por categoria</b>${barras(rec, 'var(--ok)')}</div>`;
  }

  async function fluxo(b) {
    const {data} = await sb.from('transacoes').select('tipo,valor,pago,pago_em,vencimento,data').limit(5000), T = data || [], ms = [0, 1, 2, 3, 4, 5].map(i => somaMes(mesF, i - 1));
    let acc = 0;
    b.innerHTML = `${nav(false)}<p style="color:var(--mut);margin:0 0 10px">Seis meses a partir do mês anterior ao escolhido. “Previsto” usa o vencimento; “Realizado” usa o que já foi pago ou recebido.</p>
      <div class="panel"><table><tr><th>Mês</th><th>Entradas previstas</th><th>Saídas previstas</th><th>Saldo previsto</th><th>Acumulado</th><th>Realizado (entradas − saídas)</th></tr>
      ${ms.map(m => { const pe = somaF(T.filter(x => x.tipo === 'receita' && venc(x).startsWith(m)), x => x.valor), ps = somaF(T.filter(x => x.tipo === 'despesa' && venc(x).startsWith(m)), x => x.valor);
        const re = somaF(T.filter(x => x.pago && x.tipo === 'receita' && (x.pago_em || x.data || '').startsWith(m)), x => x.valor), rs = somaF(T.filter(x => x.pago && x.tipo === 'despesa' && (x.pago_em || x.data || '').startsWith(m)), x => x.valor);
        acc += pe - ps; return `<tr><td>${m.slice(5)}/${m.slice(0, 4)}</td><td style="color:var(--ok)">${brl(pe)}</td><td style="color:var(--bad)">${brl(ps)}</td><td><b>${brl(pe - ps)}</b></td><td style="color:${acc >= 0 ? 'var(--ok)' : 'var(--bad)'}"><b>${brl(acc)}</b></td><td>${brl(re - rs)}</td></tr>`; }).join('')}</table></div>`;
  }

  async function lanc(b) {
    const {data} = await sb.from('transacoes').select('*').gte('vencimento', mesF + '-01').lt('vencimento', somaMes(mesF, 1) + '-01').order('vencimento'); cache = data || [];
    b.innerHTML = `${nav(false)}<div class="bar"><button class="btn gold" onclick="Fin.form('receita')">+ Receita</button><button class="btn sec" onclick="Fin.form('despesa')">+ Despesa</button></div>
      <div class="panel"><table><tr><th>Vencimento</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Situação</th><th></th></tr>
      ${cache.map(t => `<tr><td>${dt(venc(t))}</td><td>${t.tipo === 'receita' ? 'Receita' : 'Despesa'}</td><td>${esc(t.categoria || '—')}</td><td>${esc(t.descricao || t.fornecedor || '—')}</td><td style="color:${t.tipo === 'receita' ? 'var(--ok)' : 'var(--bad)'}">${t.tipo === 'receita' ? '' : '− '}${brl(t.valor)}</td><td>${sit(t)}</td><td><button class="btn sm sec" onclick="Fin.form('${t.tipo}','${t.id}')">Editar</button></td></tr>`).join('') || '<tr><td colspan="7">Nenhum lançamento neste mês.</td></tr>'}</table></div>`;
  }

  async function folha(b) {
    const {data} = await sb.from('folha_itens').select('*').order('nome'); folhaRows = data || [];
    b.innerHTML = `${nav(false)}<div class="bar" style="flex-wrap:wrap"><button class="btn gold" onclick="Fin.fform()">+ Colaborador</button><button class="btn sec" onclick="Fin.gerarFolha()">Gerar folha de ${mesF.slice(5)}/${mesF.slice(0, 4)}</button>
      <span style="align-self:center;margin-left:auto;color:var(--mut)">Folha mensal: <b>${brl(somaF(folhaRows.filter(x => x.ativo), x => x.valor))}</b></span></div>
      <div class="panel"><table><tr><th>Nome</th><th>Cargo</th><th>Valor mensal</th><th>Dia do pagamento</th><th>Ativo</th><th></th></tr>
      ${folhaRows.map(x => `<tr><td>${esc(x.nome)}</td><td>${esc(x.cargo || '—')}</td><td>${brl(x.valor)}</td><td>${x.dia_pagto}</td><td>${x.ativo ? 'Sim' : 'Não'}</td><td><button class="btn sm sec" onclick="Fin.fform('${x.id}')">Editar</button> ${me.role === 'admin' ? `<button class="btn sm bad" onclick="Fin.fdel('${x.id}')">Excluir</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Nenhum colaborador na folha.</td></tr>'}</table></div>`;
  }
  function fform(id) {
    const x = folhaRows.find(r => r.id === id) || {};
    $('dt').textContent = id ? 'Editar colaborador' : 'Novo colaborador na folha';
    $('db').innerHTML = `<div><label>Nome *</label><input id="fo_n" value="${esc(x.nome || '')}"></div><div><label>Cargo</label><input id="fo_c" value="${esc(x.cargo || '')}"></div>
      <div><label>Valor mensal (R$) *</label><input id="fo_v" type="number" step="any" value="${x.valor ?? ''}"></div><div><label>Dia do pagamento</label><input id="fo_d" type="number" min="1" max="28" value="${x.dia_pagto ?? 5}"></div>
      <div class="w"><label>Ativo</label><select id="fo_a"><option value="true">Sim</option><option value="false" ${x.ativo === false ? 'selected' : ''}>Não</option></select></div>`;
    $('df').innerHTML = `<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Fin.fsave('${id || ''}')">Salvar</button>`; $('dlg').showModal();
  }
  async function fsave(id) {
    const row = {nome: $('fo_n').value.trim(), cargo: $('fo_c').value || null, valor: parseFloat($('fo_v').value), dia_pagto: Math.min(28, parseInt($('fo_d').value) || 5), ativo: $('fo_a').value === 'true'};
    if (!row.nome || !row.valor) return toast('Informe nome e valor.', 1);
    const {error} = await (id ? sb.from('folha_itens').update(row).eq('id', id) : sb.from('folha_itens').insert(row));
    if (error) return toast(error.message, 1); $('dlg').close(); toast('Salvo.'); show();
  }
  async function fdel(id) { if (!confirm('Remover da folha?')) return; const {error} = await sb.from('folha_itens').delete().eq('id', id); toast(error ? error.message : 'Removido.', !!error); show(); }
  async function gerarFolha() {
    const {data: ex} = await sb.from('transacoes').select('fornecedor').eq('categoria', 'Folha').gte('vencimento', mesF + '-01').lt('vencimento', somaMes(mesF, 1) + '-01'), ja = new Set((ex || []).map(x => x.fornecedor));
    const rows = folhaRows.filter(x => x.ativo && !ja.has(x.nome)).map(x => { const v = `${mesF}-${String(Math.min(x.dia_pagto || 5, 28)).padStart(2, '0')}`; return {tipo: 'despesa', categoria: 'Folha', fornecedor: x.nome, descricao: `Folha ${mesF.slice(5)}/${mesF.slice(0, 4)} · ${x.nome}`, valor: x.valor, vencimento: v, data: v, pago: false}; });
    if (!rows.length) return toast('A folha deste mês já foi gerada.');
    const {error} = await sb.from('transacoes').insert(rows); toast(error ? error.message : `${rows.length} pagamento(s) lançado(s) em “A pagar”.`, !!error);
  }


  // ===== Contas, cartões e faturas =====
  let ctas = [], cartoesFin = [], baixaIds = [], cartSel = null, invCache = {};
  const pd = n => String(n).padStart(2, '0'), ultDia = (y, m, d) => Math.min(d, new Date(y, m, 0).getDate());
  function fatura(dataCompra, c) { // fechamento e vencimento da fatura em que a compra cai
    const F = c.dia_fechamento || 25, V = c.dia_vencimento || 5, [y, mo, d] = dataCompra.split('-').map(Number);
    const f = new Date(y, mo - 1 + (d <= F ? 0 : 1), 1), fy = f.getFullYear(), fm = f.getMonth() + 1, v = new Date(fy, fm - 1 + (V > F ? 0 : 1), 1), vy = v.getFullYear(), vm = v.getMonth() + 1;
    return {fech: `${fy}-${pd(fm)}-${pd(ultDia(fy, fm, F))}`, venc: `${vy}-${pd(vm)}-${pd(ultDia(vy, vm, V))}`};
  }
  async function carregarFin() {
    const [a, k] = await Promise.all([sb.from('contas_fin').select('*').order('nome'), sb.from('cartoes_fin').select('*').order('nome')]);
    ctas = a.data || []; cartoesFin = k.data || [];
  }
  function abrirBaixa(ids, titulo) {
    baixaIds = ids;
    if (!ctas.length) return baixaOk();
    $('dt').textContent = titulo;
    $('db').innerHTML = `<div><label>Conta</label><select id="b_conta"><option value="">— Sem conta —</option>${ctas.filter(c => c.ativo).map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div><div><label>Data</label><input id="b_data" type="date" value="${hoje()}"></div>`;
    $('df').innerHTML = '<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Fin.baixaOk()">Confirmar</button>'; $('dlg').showModal();
  }
  async function baixaOk() {
    const conta = $('b_conta')?.value || null, data = $('b_data')?.value || hoje();
    const {error} = await sb.from('transacoes').update({pago: true, pago_em: data, conta_id: conta}).in('id', baixaIds);
    $('dlg').close(); toast(error ? error.message : 'Baixa registrada.', !!error); show();
  }

  async function ctasView(b) {
    const {data} = await sb.from('transacoes').select('tipo,valor,pago_em,data,conta_id').eq('pago', true).limit(5000), T = data || [];
    const net = id => somaF(T.filter(x => x.conta_id === id && x.tipo === 'receita'), x => x.valor) - somaF(T.filter(x => x.conta_id === id && x.tipo === 'despesa'), x => x.valor);
    const mes = (id, tp) => somaF(T.filter(x => x.conta_id === id && x.tipo === tp && (x.pago_em || x.data || '').startsWith(mesF)), x => x.valor);
    const saldo = c => Number(c.saldo_inicial || 0) + net(c.id), semConta = T.some(x => !x.conta_id);
    b.innerHTML = `${nav(false)}<div class="kpis"><div class="kpi"><small>Saldo total nas contas</small><b>${brl(somaF(ctas.filter(c => c.ativo), saldo))}</b></div></div>
      <div class="bar"><button class="btn gold" onclick="Fin.cform()">+ Nova conta</button><span style="align-self:center;color:var(--mut)">O saldo é o saldo inicial mais o que foi recebido menos o que foi pago em cada conta (escolha a conta ao dar baixa).</span></div>
      <div class="panel"><table><tr><th>Conta</th><th>Tipo</th><th>Banco</th><th>Saldo atual</th><th>Entradas do mês</th><th>Saídas do mês</th><th></th></tr>
      ${ctas.map(c => `<tr><td>${esc(c.nome)}${c.ativo ? '' : ' <span class="tag">inativa</span>'}</td><td>${esc(c.tipo || '—')}</td><td>${esc(c.banco || '—')}</td><td><b style="color:${saldo(c) >= 0 ? 'var(--ok)' : 'var(--bad)'}">${brl(saldo(c))}</b></td><td>${brl(mes(c.id, 'receita'))}</td><td>${brl(mes(c.id, 'despesa'))}</td>
      <td><button class="btn sm sec" onclick="Fin.cform('${c.id}')">Editar</button> ${me.role === 'admin' ? `<button class="btn sm bad" onclick="Fin.cdel('${c.id}')">Excluir</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7">Nenhuma conta cadastrada.</td></tr>'}
      ${semConta ? `<tr><td colspan="3"><i>Sem conta definida</i></td><td>${brl(net(null))}</td><td>${brl(mes(null, 'receita'))}</td><td>${brl(mes(null, 'despesa'))}</td><td></td></tr>` : ''}</table></div>`;
  }
  function cform(id) {
    const c = ctas.find(x => x.id === id) || {};
    $('dt').textContent = id ? 'Editar conta' : 'Nova conta';
    $('db').innerHTML = `<div><label>Nome *</label><input id="c_nome" value="${esc(c.nome || '')}"></div><div><label>Tipo</label><select id="c_tipo">${['corrente', 'poupanca', 'caixa', 'investimento'].map(t => `<option ${t === (c.tipo || 'corrente') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Banco</label><input id="c_banco" value="${esc(c.banco || '')}"></div><div><label>Saldo inicial (R$)</label><input id="c_ini" type="number" step="any" value="${c.saldo_inicial ?? 0}"></div>
      <div class="w"><label>Ativa</label><select id="c_at"><option value="true">Sim</option><option value="false" ${c.ativo === false ? 'selected' : ''}>Não</option></select></div>`;
    $('df').innerHTML = `<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Fin.csave('${id || ''}')">Salvar</button>`; $('dlg').showModal();
  }
  async function csave(id) {
    const row = {nome: $('c_nome').value.trim(), tipo: $('c_tipo').value, banco: $('c_banco').value || null, saldo_inicial: parseFloat($('c_ini').value) || 0, ativo: $('c_at').value === 'true'};
    if (!row.nome) return toast('Informe o nome da conta.', 1);
    const {error} = await (id ? sb.from('contas_fin').update(row).eq('id', id) : sb.from('contas_fin').insert(row));
    if (error) return toast(error.message, 1); $('dlg').close(); await carregarFin(); toast('Salvo.'); show();
  }
  async function cdel(id) { if (!confirm('Excluir a conta? Os lançamentos continuam, apenas sem conta definida.')) return; const {error} = await sb.from('contas_fin').delete().eq('id', id); toast(error ? error.message : 'Excluída.', !!error); await carregarFin(); show(); }

  async function faturas(b) {
    const novo = '<button class="btn gold" onclick="Fin.kform()">+ Cartão de crédito</button>';
    if (!cartoesFin.length) return b.innerHTML = `<div class="bar">${novo}</div><p style="color:var(--mut)">Cadastre o cartão da agência. Depois, ao lançar uma despesa, escolha o cartão: o vencimento é calculado pela fatura e a conta aparece em “A pagar”.</p>`;
    if (!cartSel || !cartoesFin.some(c => c.id === cartSel)) cartSel = cartoesFin[0].id;
    const c = cartoesFin.find(x => x.id === cartSel), {data} = await sb.from('transacoes').select('*').eq('cartao_id', c.id).order('data'), T = data || [], g = {};
    T.forEach(t => { const f = fatura(t.data, c); (g[f.fech] = g[f.fech] || {...f, itens: []}).itens.push(t); });
    invCache = g; const inv = Object.values(g).sort((a, b2) => b2.fech.localeCompare(a.fech)), usado = somaF(T.filter(t => !t.pago), t => t.valor), h = hoje();
    b.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${cartoesFin.map(x => `<button class="btn sm ${x.id === cartSel ? 'gold' : 'sec'}" onclick="Fin.cart('${x.id}')">${esc(x.nome)}${x.final ? ' •' + esc(x.final) : ''}</button>`).join('')}${novo}</div>
      <div class="kpis"><div class="kpi"><small>Limite</small><b>${brl(c.limite)}</b></div><div class="kpi"><small>Em aberto</small><b>${brl(usado)}</b></div><div class="kpi"><small>Disponível</small><b style="color:var(--ok)">${brl(Number(c.limite || 0) - usado)}</b></div><div class="kpi"><small>Fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento}</small><b style="font-size:1rem"><button class="btn sm sec" onclick="Fin.kform('${c.id}')">Editar cartão</button></b></div></div>
      <div class="bar"><button class="btn gold" onclick="Fin.form('despesa','','${c.id}')">+ Compra no cartão</button></div>
      ${inv.map(f => { const paga = f.itens.every(t => t.pago), tot = somaF(f.itens, t => t.valor), st = paga ? 'Paga' : f.fech <= h ? 'Fechada' : 'Aberta';
        return `<details class="panel" style="margin-bottom:8px;padding:10px 14px"><summary style="cursor:pointer"><b>Fatura ${f.fech.slice(5, 7)}/${f.fech.slice(0, 4)}</b> · fecha ${dt(f.fech)} · vence ${dt(f.venc)} · <b>${brl(tot)}</b> <span class="tag">${st}</span>
        ${paga ? '' : ` <button class="btn sm gold" onclick="event.preventDefault();Fin.pagarFatura('${f.fech}')">Pagar fatura</button>`}</summary>
        <table><tr><th>Data</th><th>Descrição</th><th>Valor</th><th></th></tr>${f.itens.map(t => `<tr><td>${dt(t.data)}</td><td>${esc(t.descricao || t.categoria || '—')}</td><td>${brl(t.valor)}</td><td><button class="btn sm sec" onclick="Fin.form('despesa','${t.id}')">Editar</button></td></tr>`).join('')}</table></details>`; }).join('') || '<p style="color:var(--mut)">Nenhuma compra neste cartão ainda.</p>'}`;
    cache = T;
  }
  function pagarFatura(fech) { const f = invCache[fech]; if (!f) return; abrirBaixa(f.itens.filter(t => !t.pago).map(t => t.id), 'Pagar fatura de ' + fech.slice(5, 7) + '/' + fech.slice(0, 4)); }
  function kform(id) {
    const c = cartoesFin.find(x => x.id === id) || {};
    $('dt').textContent = id ? 'Editar cartão' : 'Novo cartão de crédito';
    $('db').innerHTML = `<div><label>Nome *</label><input id="k_nome" value="${esc(c.nome || '')}"></div><div><label>Banco</label><input id="k_banco" value="${esc(c.banco || '')}"></div><div><label>Final (4 dígitos)</label><input id="k_fin" value="${esc(c.final || '')}"></div><div><label>Limite (R$)</label><input id="k_lim" type="number" step="any" value="${c.limite ?? 0}"></div>
      <div><label>Dia do fechamento</label><input id="k_fec" type="number" min="1" max="31" value="${c.dia_fechamento ?? 25}"></div><div><label>Dia do vencimento</label><input id="k_ven" type="number" min="1" max="31" value="${c.dia_vencimento ?? 5}"></div>
      <div class="w"><label>Ativo</label><select id="k_at"><option value="true">Sim</option><option value="false" ${c.ativo === false ? 'selected' : ''}>Não</option></select></div>`;
    $('df').innerHTML = `${id && me.role === 'admin' ? `<button class="btn bad" onclick="Fin.kdel('${id}')">Excluir</button>` : ''}<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Fin.ksave('${id || ''}')">Salvar</button>`; $('dlg').showModal();
  }
  async function ksave(id) {
    const row = {nome: $('k_nome').value.trim(), banco: $('k_banco').value || null, final: $('k_fin').value || null, limite: parseFloat($('k_lim').value) || 0, dia_fechamento: parseInt($('k_fec').value) || 25, dia_vencimento: parseInt($('k_ven').value) || 5, ativo: $('k_at').value === 'true'};
    if (!row.nome) return toast('Informe o nome do cartão.', 1);
    const {error} = await (id ? sb.from('cartoes_fin').update(row).eq('id', id) : sb.from('cartoes_fin').insert(row));
    if (error) return toast(error.message, 1); $('dlg').close(); await carregarFin(); toast('Salvo.'); show();
  }
  async function kdel(id) { if (!confirm('Excluir o cartão? As compras continuam, sem cartão.')) return; const {error} = await sb.from('cartoes_fin').delete().eq('id', id); $('dlg').close(); toast(error ? error.message : 'Excluído.', !!error); await carregarFin(); show(); }

  window.Fin = {baixaOk, cform, csave, cdel, kform, ksave, kdel, pagarFatura, cart: k => { cartSel = k; show(); }, mes: v => { mesF = v || mesF; show(); }, reg: r => { regime = r; show(); }, fform, fsave, fdel, gerarFolha, tab: k => { tab = k; run(); }, pagos, baixar, del, form, save, parcelar, gerar, gerarCom, pagarCom, setPct};
  window.EXTRA = Object.assign(window.EXTRA || {}, {financeiro: {l: 'Financeiro', run}});
})();
