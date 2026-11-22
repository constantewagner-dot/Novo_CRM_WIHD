-- WIHD CRM - Fase 3 (WhatsApp). Rode depois do schema.sql e do fase2_milhas.sql.

create table wa_conversas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes on delete set null,
  telefone text not null unique,          -- so digitos, com DDI (ex: 5547999998888)
  nome text, ultima_msg text, ultima_em timestamptz, nao_lidas int default 0,
  criado_em timestamptz default now()
);
create table wa_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid references wa_conversas on delete cascade,
  direcao text not null check (direcao in ('in','out')),
  texto text, status text default 'enviada',   -- enviada | recebida | manual
  wa_id text, autor uuid default auth.uid(), criado_em timestamptz default now()
);
create table wa_modelos (id uuid primary key default gen_random_uuid(), titulo text not null, texto text not null, criado_em timestamptz default now());

insert into wa_modelos(titulo, texto) values
 ('Boas-vindas', 'Olá, {nome}! Aqui é da WIHD Milhas e Viagens. Como podemos ajudar na sua próxima viagem?'),
 ('Check-in aberto', 'Olá, {nome}! O check-in da sua viagem já está disponível. Posso fazer para você?'),
 ('Cobrança', 'Olá, {nome}! Passando para lembrar do pagamento da sua viagem. Qualquer dúvida, estou à disposição.'),
 ('Pós-viagem', 'Olá, {nome}! Como foi a viagem? Adoraríamos saber sua opinião e já planejar a próxima.');

create function wa_msg_resumo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update wa_conversas set ultima_msg = left(new.texto, 80), ultima_em = new.criado_em,
         nao_lidas = nao_lidas + case when new.direcao = 'in' then 1 else 0 end
   where id = new.conversa_id;
  return new;
end $$;
create trigger trg_wa_resumo after insert on wa_mensagens for each row execute function wa_msg_resumo();

-- Acha o cliente pelos 8 ultimos digitos do telefone
create function wa_achar_cliente(p text) returns uuid language sql security definer set search_path = public as $$
  select id from clientes
   where length(regexp_replace(coalesce(telefone,''), '\D', '', 'g')) >= 8
     and regexp_replace(telefone, '\D', '', 'g') like '%' || right(p, 8) limit 1
$$;

do $$ declare t text; begin
  foreach t in array array['wa_conversas','wa_mensagens','wa_modelos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "staff_select" on %I for select using (is_staff())', t);
    execute format('create policy "staff_insert" on %I for insert with check (is_staff())', t);
    execute format('create policy "staff_update" on %I for update using (is_staff())', t);
    execute format('create policy "admin_delete" on %I for delete using (is_admin())', t);
  end loop;
end $$;

alter publication supabase_realtime add table wa_mensagens, wa_conversas;
