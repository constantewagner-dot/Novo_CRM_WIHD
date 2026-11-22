// WIHD CRM - Acompanhamentos: Voos, Hospedagens, Transportes, Cruzeiros, Seguros e Adicionais
(function () {
  const T = {
    voo: {l: 'Voos', s: 'Todos os voos, organizados pelos próximos embarques.', f: 'Companhia', d: 'Nº do voo', k: ['Voos no período', 'Passageiros', 'Sem companhia']},
    hospedagem: {l: 'Hospedagens', s: 'Hospedagens das vendas, organizadas pelos próximos check-ins.', f: 'Hotel', d: 'Quarto / reserva', k: ['Em estadia agora', 'Noites', 'Sem reserva']},
    transporte: {l: 'Transportes', s: 'Transportes das vendas, organizados pela próxima data.', f: 'Locadora / serviço', d: 'Veículo', k: ['Em uso agora', 'Diárias', 'Sem reserva']},
    cruzeiro: {l: 'Cruzeiros', s: 'Cruzeiros, organizados pelos próximos embarques.', f: 'Companhia', d: 'Navio / cabine', k: ['A bordo agora', 'Noites', 'Sem cabine']},
    seguro: {l: 'Seguros', s: 'Seguros viagem, organizados pelos próximos inícios de cobertura.', f: 'Seguradora', d: 'Apólice / plano', k: ['Coberturas ativas', 'Dias de cobertura', 'Sem plano']},
    adicional: {l: 'Adicionais', s: 'Serviços adicionais, organizados pelos próximos inícios.', f: 'Fornecedor', d: 'Serviço', k: ['Em andamento', 'Valor no período', 'Sem data']}
  };
  const STATUS = ['Pendente', 'Confirmado', 'Em andamento', 'Concluído', 'Cancelado'];
  let tipo = 'voo', per = 'prox', rows = [];
  const dias = (a, b) => a && b ? Math.max(0, Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5)) : 0;
  const maisDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const ativo = (r, h) => r.status !== 'Cancelado' && r.data_ida && r.data_ida <= h && (r.data_volta ? r.data_volta >= h : r.data_ida === h);
  const soma = (a, f) => a.reduce((s, x) => s + Number(f(x) || 0), 0);

  function filtro(a, p, h) {
    if (p === 'todos') return a;
    if (p === 'prox') return a.filter(r => ativo(r, h) || (r.data_ida && r.data_ida >= h));
    const lim = maisDias(p === '7' ? 7 : 30);
    return a.filter(r => ativo(r, h) || (r.data_ida && r.data_ida >= h && r.data_ida <= lim));
  }

  async function run() {
    const {data} = await sb.from('viagens').select('*').order('data_ida', {ascending: true, nullsFirst: false}).limit(2000);
    rows = data || []; show();
  }
  function show() {
    const E = T[tipo], h = hojeISO(), all = rows.filter(r => r.tipo === tipo), q = ($('a_q')?.value || '').toLowerCase();
    const base = filtro(all, per, h).filter(r => !q || ((cn(r.cliente_id)) + ' ' + (r.destino || '') + ' ' + (r.fornecedor || '') + ' ' + (r.localizador || '') + ' ' + (r.detalhe || '')).toLowerCase().includes(q));
    const lista = per === 'todos' ? [...base].reverse() : base;
    const sem = tipo === 'voo' ? base.filter(r => !r.fornecedor).length : tipo === 'adicional' ? base.filter(r => !r.data_ida).length : base.filter(r => !r.localizador).length;
    const k2 = tipo === 'voo' ? base.length : tipo === 'adicional' ? all.filter(r => ativo(r, h)).length : all.filter(r => ativo(r, h)).length;
    const k3 = tipo === 'voo' ? soma(base, r => r.passageiros) : tipo === 'adicional' ? null : soma(base, r => dias(r.data_ida, r.data_volta));
    const kp = (l, v, s) => `<div class="kpi"><small>${l}</small><b${v === sem && sem ? ' style="color:var(--bad)"' : ''}>${v}</b><small>${s}</small></div>`;
    const chips = [['prox', 'Próximos'], ['7', '7 dias'], ['30', '30 dias'], ['todos', 'Todos']].map(([k, l]) => `<button class="btn sm ${k === per ? 'gold' : 'sec'}" onclick="Acomp.per('${k}')">${l} ${filtro(all, k, h).length}</button>`).join(' ');
    $('view').innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${Object.entries(T).map(([k, t]) => `<button class="btn sm ${k === tipo ? 'gold' : 'sec'}" onclick="Acomp.tipo('${k}')">${t.l}</button>`).join('')}</div>
      <p style="margin:0 0 12px;color:var(--mut)">${E.s}</p>
      <div class="kpis"><div class="kpi"><small>Valor total</small><b>${brl(soma(base, r => r.valor))}</b><small>${base.length} no período</small></div>
      ${kp(E.k[0], k2, 'agora')}${kp(E.k[1], k3 === null ? brl(soma(base, r => r.valor)) : k3, 'somados')}${kp(E.k[2], sem, sem ? 'pendência' : 'tudo certo')}</div>
      <div class="bar" style="flex-wrap:wrap"><input id="a_q" placeholder="Buscar cliente, ${E.f.toLowerCase()}, localizador…" value="${esc(q)}" oninput="Acomp.busca()"><span style="display:flex;gap:6px;flex-wrap:wrap">${chips}</span><button class="btn gold" onclick="Acomp.form()">+ Novo</button></div>
      <div class="panel"><table><tr><th>Cliente</th><th>Destino</th><th>${E.f}</th><th>Localizador</th><th>Ida</th><th>Volta</th><th>Valor</th><th>Status</th><th></th></tr>
      ${lista.map(r => `<tr><td>${esc(cn(r.cliente_id))}</td><td>${esc(r.destino || '—')}</td><td>${esc(r.fornecedor || '—')}</td><td>${esc(r.localizador || '—')}</td><td>${dt(r.data_ida)}</td><td>${dt(r.data_volta)}</td><td>${brl(r.valor)}</td>
      <td><span class="tag">${ativo(r, h) ? 'Agora' : esc(r.status || '—')}</span></td><td>${tipo === 'voo' ? `<button class="btn sm ${r.checkin_feito ? 'sec' : 'gold'}" onclick="Acomp.checkin('${r.id}')">${r.checkin_feito ? 'Check-in feito' : 'Fazer check-in'}</button> ` : ''}
      <button class="btn sm sec" onclick="Acomp.form('${r.id}')">Editar</button> <button class="btn sm sec" onclick="portal('${r.portal_token}')">Link</button></td></tr>`).join('') || `<tr><td colspan="9">Nenhum registro encontrado.</td></tr>`}</table></div>`;
    const i = $('a_q'); if (q) { i.focus(); i.setSelectionRange(q.length, q.length); }
  }
  async function checkin(id) { const r = rows.find(x => x.id === id), v = !r.checkin_feito; const {error} = await sb.from('viagens').update({checkin_feito: v}).eq('id', id); if (error) return toast(error.message, 1); r.checkin_feito = v; show(); }

  function form(id) {
    const E = T[tipo], r = rows.find(x => x.id === id) || {};
    $('dt').textContent = (id ? 'Editar · ' : 'Novo · ') + E.l;
    $('db').innerHTML = `<div class="w"><label>Cliente *</label><select id="a_cli"><option value="">— Selecionar —</option>${clientes.map(c => `<option value="${c.id}" ${c.id === r.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></div>
      <div><label>Destino / trecho</label><input id="a_des" value="${esc(r.destino || '')}"></div><div><label>${E.f}</label><input id="a_for" value="${esc(r.fornecedor || '')}"></div>
      <div><label>Localizador</label><input id="a_loc" value="${esc(r.localizador || '')}"></div><div><label>${E.d}</label><input id="a_det" value="${esc(r.detalhe || '')}"></div>
      <div><label>Ida / início</label><input id="a_ida" type="date" value="${r.data_ida || ''}"></div><div><label>Volta / fim</label><input id="a_vol" type="date" value="${r.data_volta || ''}"></div>
      <div><label>Valor (R$)</label><input id="a_val" type="number" step="any" value="${r.valor ?? 0}"></div><div><label>Passageiros</label><input id="a_pas" type="number" min="1" value="${r.passageiros ?? 1}"></div>
      <div class="w"><label>Status</label><select id="a_sta">${STATUS.map(s => `<option ${s === (r.status || 'Pendente') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="w"><label>Notas</label><textarea id="a_not" rows="2">${esc(r.notas || '')}</textarea></div>`;
    $('df').innerHTML = `${id && me.role === 'admin' ? `<button class="btn bad" onclick="Acomp.del('${id}')">Excluir</button>` : ''}<button class="btn sec" onclick="dlg.close()">Cancelar</button><button class="btn gold" onclick="Acomp.save('${id || ''}')">Salvar</button>`;
    $('dlg').showModal();
  }
  async function save(id) {
    const cli = $('a_cli').value; if (!cli) return toast('Escolha o cliente.', 1);
    const row = {tipo, cliente_id: cli, destino: $('a_des').value || null, fornecedor: $('a_for').value || null, localizador: $('a_loc').value || null, detalhe: $('a_det').value || null,
      data_ida: $('a_ida').value || null, data_volta: $('a_vol').value || null, valor: parseFloat($('a_val').value) || 0, passageiros: parseInt($('a_pas').value) || 1, status: $('a_sta').value, notas: $('a_not').value || null};
    const {error} = await (id ? sb.from('viagens').update(row).eq('id', id) : sb.from('viagens').insert(row));
    if (error) return toast(error.message, 1);
    $('dlg').close(); toast('Salvo.'); run();
  }
  async function del(id) { if (!confirm('Excluir este registro?')) return; const {error} = await sb.from('viagens').delete().eq('id', id); if (error) return toast(error.message, 1); $('dlg').close(); run(); }

  window.Acomp = {tipo: k => { tipo = k; show(); }, per: k => { per = k; show(); }, busca: show, checkin, form, save, del};
  window.EXTRA = Object.assign(window.EXTRA || {}, {viagens: {l: 'Acompanhamentos', run}});
})();
