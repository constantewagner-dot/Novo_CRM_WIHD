// WIHD CRM - Vendas com custo, lucro e margem (estilo Volly)
(function () {
  const TIPOS = [['milhas_proprias', 'Milhas próprias'], ['milhas_terceiros', 'Milhas de terceiros'], ['dinheiro', 'Dinheiro / consolidadora'], ['pacote', 'Pacote']];
  const PG = ['Pendente', 'Parcial', 'Pago'];
  let rows = [], rec = {}, com = {}, mes = hojeISO().slice(0, 7), padrao = 25;
  const n = x => Number(x || 0), fm = x => Number(x || 0).toLocaleString('pt-BR');
  const cpmDe = v => v.cpm != null ? n(v.cpm) : padrao;
  const custoMilhas = v => n(v.milhas) / 1000 * cpmDe(v);
  const custo = v => custoMilhas(v) + n(v.taxas) + n(v.custo_outros);
  const lucro = v => n(v.valor) - custo(v);
  const margem = v => n(v.valor) ? lucro(v) / n(v.valor) * 100 : 0;
  const soma = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const pct = x => x.toLocaleString('pt-BR', {maximumFractionDigits: 1}) + '%';
  const tipoL = k => TIPOS.find(t => t[0] === k)?.[1] || '—';

  async function run() {
    const [c, v, k, tr] = await Promise.all([sb.from('config_app').select('valor_milha').maybeSingle(), sb.from('vendas').select('*').order('data_venda', {ascending: false}).limit(2000), sb.from('comissoes').select('venda_id,valor'), sb.from('transacoes').select('venda_id,valor,pago').eq('tipo', 'receita').not('venda_id', 'is', null)]);
    padrao = (Number(c.data?.valor_milha) || 0.025) * 1000; rows = v.data || [];
    com = Object.fromEntries((k.data || []).map(x => [x.venda_id, x.valor])); rec = {};
    (tr.data || []).forEach(x => { const r = rec[x.venda_id] || (rec[x.venda_id] = {tot: 0, pago: 0}); r.tot += n(x.valor); if (x.pago) r.pago += n(x.valor); }); show();
  }

  function show() {
    const q = ($('v_q')?.value || '').toLowerCase();
    const L = rows.filter(v => (!mes || (v.data_venda || '').startsWith(mes)) && (!q || (cn(v.cliente_id) + ' ' + (v.localizador || '') + ' ' + (v.destino || '') + ' ' + (v.servico || '')).toLowerCase().includes(q)));
    const tv = soma(L, v => n(v.valor)), tl = soma(L, lucro), tc = soma(L, custo), tm = soma(L, v => n(v.milhas)), cmi = soma(L, custoMilhas), emis = L.filter(v => n(v.milhas) > 0).length;
    const kp = (l, v, s, cor) => `<div class="kpi"><small>${l}</small><b${cor ? ` style="color:${cor}"` : ''}>${v}</b><small>${s}</small></div>`;
    $('view').innerHTML = `<div class="kpis">${kp('Lucro total', brl(tl), (tv ? pct(tl / tv * 100) : '0%') + ' das vendas', tl < 0 ? 'var(--bad)' : 'var(--ok)')}
      ${kp('Total de vendas', brl(tv), 'Ticket médio: ' + brl(L.length ? tv / L.length : 0))}${kp('Custo total', brl(tc), 'Soma de custos')}
      ${kp('Custo de milhas', brl(cmi), 'Custo médio: ' + brl(tm ? cmi / tm * 1000 : 0) + ' / milheiro')}${kp('Total de milhas', fm(tm), 'Média por emissão: ' + fm(emis ? Math.round(tm / emis) : 0))}
      ${kp('Performance', tv ? pct(tl / tv * 100) : '—', 'Lucro médio: ' + brl(L.length ? tl / L.length : 0))}</div>
      <div class="bar" style="flex-wrap:wrap"><input type="month" value="${mes}" onchange="Vend.mes(this.value)" style="flex:0 0 auto"><button class="btn sm sec" onclick="Vend.mes('')">Todos os meses</button>
      <input id="v_q" placeholder="Buscar cliente, localizador, destino…" value="${esc(q)}" oninput="Vend.busca()"><button class="btn sec" onclick="Vend.csv()">Exportar CSV</button><button class="btn gold" onclick="Vend.form()">+ Nova venda</button></div>
      <div class="panel"><table><tr><th>Data</th><th>Localizador</th><th>Cliente</th><th>Serviço</th><th>Valor</th><th>Custo total</th><th>Lucro</th><th>Margem</th><th>Milhas</th><th>CPM</th><th>Pgto cliente</th><th>Comissão equipe</th><th></th></tr>
      ${L.map(v => `<tr><td>${dt(v.data_venda)}</td><td>${esc(v.localizador || '—')}</td><td>${esc(cn(v.cliente_id))}</td><td>${esc(v.servico || '—')}<br><small style="color:var(--mut)">${tipoL(v.tipo_venda)}</small></td><td><b>${brl(v.valor)}</b></td>
      <td>${custo(v) ? brl(custo(v)) : '<span class="tag">sem custo</span>'}</td><td style="color:${lucro(v) < 0 ? 'var(--bad)' : 'var(--ok)'}"><b>${brl(lucro(v))}</b></td><td>${pct(margem(v))}</td>
      <td>${n(v.milhas) ? fm(v.milhas) : '—'}</td><td>${n(v.milhas) ? brl(cpmDe(v)) : '—'}</td><td><span class="tag">${esc(v.pgto_status || 'Pendente')}</span>${rec[v.id] ? `<br><small style="color:var(--mut)">${brl(rec[v.id].pago)} de ${brl(rec[v.id].tot)}</small>` : ''}</td><td>${com[v.id] != null ? brl(com[v.id]) : '—'}</td>
      <td><button class="btn sm sec" onclick="Vend.form('${v.id}')">Editar</button>${!rec[v.id] && ['admin', 'financeiro'].includes(me.role) ? ` <button class="btn sm gold" onclick="Fin.parcelar('${v.id}')">Cobrar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="13">Nenhuma venda neste período.</td></tr>'}</table></div>`;
    const i = $('v_q'); if (q) { i.focus(); i.setSelectionRange(q.length, q.length); }
  }

  function form(id) {
    const v = rows.find(x => x.id === id) || {};
    $('dt').textContent = id ? 'Editar venda' : 'Nova venda';
    const f = (i, l, val, t = 'number', w) => `<div${w ? ' class="w"' : ''}><label>${l}</label><input id="${i}" type="${t}" step="any" value="${val ?? ''}" ${t === 'number' ? 'oninput="Vend.calc()"' : ''}></div>`;
    $('db').innerHTML = `<div class="w"><label>Cliente *</label><select id="v_cli"><option value="">— Selecionar —</option>${clientes.map(c => `<option value="${c.id}" ${c.id === v.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      ${f('v_data', 'Data da venda *', v.data_venda || hojeISO(), 'date')}${f('v_loc', 'Localizador', v.localizador, 'text')}
      <div><label>Serviço</label><select id="v_serv"><option value="">— Selecionar —</option>${SERV.map(s => `<option ${s === v.servico ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label>Tipo de venda</label><select id="v_tipo"><option value="">—</option>${TIPOS.map(([k, l]) => `<option value="${k}" ${k === v.tipo_venda ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${f('v_dest', 'Destino', v.destino, 'text', 1)}${f('v_val', 'Valor da venda (R$) *', v.valor)}${f('v_com', 'Comissão da agência (%)', v.comissao_pct ?? 10)}
      ${f('v_mil', 'Milhas utilizadas', v.milhas)}${f('v_cpm', 'CPM: custo do milheiro (R$) — vazio = padrão ' + padrao, v.cpm)}${f('v_tax', 'Taxas pagas (R$)', v.taxas)}${f('v_out', 'Outros custos (R$)', v.custo_outros)}
      <div class="w" id="v_prev" style="background:var(--soft);border-radius:8px;padding:10px"></div>
      <div><label>Pagamento do cliente</label><select id="v_pg">${PG.map(p => `<option ${p === (v.pgto_status || 'Pendente') ? 'selected' : ''}>${p}</option>`).join('')}</select></div>${f('v_fp', 'Forma de pagamento', v.forma_pagamento, 'text')}
      <div class="w"><label>Observações</label><textarea id="v_obs" rows="2">${esc(v.observacoes || '')}</textarea></div>`;
    $('df').innerHTML = `${id && me.role === 'admin' ? `<button class="btn bad" onclick="Vend.del('${id}')">Excluir</button>` : ''}<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Vend.save('${id || ''}')">Salvar</button>`;
    $('dlg').showModal(); calc();
  }
  function lido() {
    const g = i => $(i).value === '' ? null : parseFloat($(i).value);
    return {valor: g('v_val') || 0, milhas: Math.round(g('v_mil') || 0), cpm: g('v_cpm'), taxas: g('v_tax') || 0, custo_outros: g('v_out') || 0};
  }
  function calc() {
    const v = lido(), l = lucro(v); $('v_prev').innerHTML = `Custo das milhas <b>${brl(custoMilhas(v))}</b> · Custo total <b>${brl(custo(v))}</b> · Lucro <b style="color:${l < 0 ? 'var(--bad)' : 'var(--ok)'}">${brl(l)}</b> · Margem <b>${pct(margem(v))}</b>`;
  }
  async function save(id) {
    const cli = $('v_cli').value, d = lido(); if (!cli || !d.valor || !$('v_data').value) return toast('Preencha cliente, valor e data.', 1);
    const row = {cliente_id: cli, data_venda: $('v_data').value, localizador: $('v_loc').value || null, servico: $('v_serv').value || null, tipo_venda: $('v_tipo').value || null, destino: $('v_dest').value || null,
      ...d, comissao_pct: parseFloat($('v_com').value) || 0, pgto_status: $('v_pg').value, forma_pagamento: $('v_fp').value || null, observacoes: $('v_obs').value || null};
    const {error} = await (id ? sb.from('vendas').update(row).eq('id', id) : sb.from('vendas').insert(row));
    if (error) return toast(error.message, 1);
    $('dlg').close(); toast('Venda salva.'); run();
  }
  async function del(id) { if (!confirm('Excluir esta venda?')) return; const {error} = await sb.from('vendas').delete().eq('id', id); if (error) return toast(error.message, 1); $('dlg').close(); run(); }

  function csv() {
    const L = rows.filter(v => !mes || (v.data_venda || '').startsWith(mes)), num = x => n(x).toFixed(2).replace('.', ',');
    const lin = [['Data', 'Localizador', 'Cliente', 'Serviço', 'Tipo', 'Valor', 'Custo total', 'Lucro', 'Margem %', 'Milhas', 'CPM', 'Pgto cliente']].concat(L.map(v => [dt(v.data_venda), v.localizador || '', cn(v.cliente_id), v.servico || '', tipoL(v.tipo_venda), num(v.valor), num(custo(v)), num(lucro(v)), num(margem(v)), n(v.milhas), n(v.milhas) ? num(cpmDe(v)) : '', v.pgto_status || '']));
    const blob = new Blob(['\ufeff' + lin.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')], {type: 'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `vendas-${mes || 'todas'}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  window.Vend = {reload: run, mes: v => { mes = v; show(); }, busca: show, form, calc, save, del, csv};
  window.EXTRA = Object.assign(window.EXTRA || {}, {vendas: {l: 'Vendas', run}});
})();
