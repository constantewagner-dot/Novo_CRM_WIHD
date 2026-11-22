// WIHD CRM - Mapa de viagens (Leaflet + OpenStreetMap/Nominatim)
(function () {
  let map, layer;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const COR = {agora: ['#22a366', 'Em viagem'], embarque: ['#f59e0b', 'Embarque em 48h'], volta: ['#3b82f6', 'Retorno hoje']};
  const maisDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function loadLeaflet() {
    return new Promise(res => {
      if (window.L) return res();
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js'; s.onload = res; document.head.appendChild(s);
    });
  }
  async function geocode(q) {
    const key = 'geo:' + q.toLowerCase();
    try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch (e) {}
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q)), j = await r.json();
      await sleep(1100); // limite do serviço gratuito: 1 consulta por segundo
      if (!j[0]) return null;
      const p = {lat: +j[0].lat, lng: +j[0].lon};
      try { localStorage.setItem(key, JSON.stringify(p)); } catch (e) {}
      return p;
    } catch (e) { return null; }
  }

  async function run() {
    $('view').innerHTML = `<div class="bar" style="flex-wrap:wrap"><button class="btn gold" id="mp_btn" onclick="Mapa.localizar()">Localizar cidades dos clientes</button>
      <label style="align-self:center"><input type="checkbox" id="mp_home" checked onchange="Mapa.desenhar()"> mostrar cidade dos clientes</label>
      <span id="mp_n" class="tag" style="align-self:center;margin-left:auto"></span></div>
      <p style="margin:0 0 10px;color:var(--mut)">Clientes em viagem agora, embarcando em até 48h ou retornando hoje.
      ${Object.values(COR).map(([c, l]) => `&nbsp; <span style="color:${c}">●</span> ${l}`).join('')} &nbsp; <span style="color:#8a97ad">●</span> Cidade do cliente</p>
      <div id="map" style="height:66vh;border-radius:8px;border:2px solid var(--gold)"></div><p id="mp_info" style="color:var(--mut)"></p>`;
    await loadLeaflet();
    map = L.map('map').setView([-15, -50], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 18, attribution: '© OpenStreetMap'}).addTo(map);
    layer = L.layerGroup().addTo(map);
    await desenhar();
  }

  async function desenhar() {
    if (!layer) return; layer.clearLayers();
    const hoje = hojeISO(), lim = maisDias(2);
    const [c, v] = await Promise.all([sb.from('clientes').select('id,nome,cidade_atual,lat,lng'),
      sb.from('viagens').select('*').lte('data_ida', lim).or(`data_volta.gte.${hoje},data_volta.is.null`)]);
    const cs = c.data || [], pts = [];
    if ($('mp_home')?.checked) cs.filter(x => x.lat != null).forEach(x => {
      L.circleMarker([x.lat, x.lng], {radius: 5, color: '#8a97ad', fillColor: '#8a97ad', fillOpacity: .7}).bindPopup(`<b>${esc(x.nome)}</b><br>${esc(x.cidade_atual || '')}`).addTo(layer); pts.push([x.lat, x.lng]);
    });
    const cat = t => t.status === 'Cancelado' || !t.destino ? null : t.data_volta === hoje ? 'volta' : t.data_ida <= hoje ? ((t.data_volta || t.data_ida) >= hoje ? 'agora' : null) : (t.data_ida <= lim ? 'embarque' : null);
    const ativos = [];
    for (const t of (v.data || [])) {
      const k = cat(t); if (!k) continue;
      const p = await geocode(t.destino); if (!p) continue;
      ativos.push(t.cliente_id);
      L.circleMarker([p.lat, p.lng], {radius: 11, color: '#fff', weight: 2, fillColor: COR[k][0], fillOpacity: .95})
        .bindPopup(`<b>${esc(cn(t.cliente_id))}</b> · ${COR[k][1]}<br>${esc(t.tipo)} · ${esc(t.destino)}${t.fornecedor ? ' · ' + esc(t.fornecedor) : ''}<br>${t.localizador ? 'Localizador ' + esc(t.localizador) + '<br>' : ''}${dt(t.data_ida)} → ${dt(t.data_volta)}`).addTo(layer);
      pts.push([p.lat, p.lng]);
    }
    if (pts.length) map.fitBounds(pts, {padding: [40, 40], maxZoom: 8});
    $('mp_n').textContent = `${new Set(ativos).size} clientes ativos`;
    const sem = cs.filter(x => x.lat == null && x.cidade_atual).length, semCid = cs.filter(x => !x.cidade_atual).length;
    $('mp_info').textContent = (sem ? `${sem} cliente(s) aguardando localização. ` : '') + (semCid ? `${semCid} sem cidade cadastrada.` : '');
  }

  async function localizar() {
    const btn = $('mp_btn'); btn.disabled = true;
    const {data} = await sb.from('clientes').select('id,cidade_atual').is('lat', null).not('cidade_atual', 'is', null);
    let n = 0;
    for (const x of (data || [])) {
      btn.textContent = `Localizando ${++n} de ${data.length}…`;
      const p = await geocode(x.cidade_atual);
      if (p) await sb.from('clientes').update({lat: p.lat, lng: p.lng}).eq('id', x.id);
    }
    btn.disabled = false; btn.textContent = 'Localizar cidades dos clientes'; toast('Localização concluída.'); desenhar();
  }

  window.Mapa = {localizar, desenhar};
  window.EXTRA = Object.assign(window.EXTRA || {}, {mapa: {l: 'Mapa de viagens', run}});
})();
