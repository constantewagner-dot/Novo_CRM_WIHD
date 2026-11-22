-- WIHD CRM - TODOS OS SCRIPTS NA ORDEM. Cole no Supabase > SQL Editor e execute UMA vez.

-- ================= schema =================
-- WIHD Milhas e Viagens CRM - Fase 1
-- Cole no Supabase: SQL Editor > New query > Run

create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text, role text not null default 'vendedor' check (role in ('admin','vendedor','financeiro')),
  ativo boolean default true, criado_em timestamptz default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  codigo serial, nome text not null, email text, telefone text, cpf text,
  aniversario date, endereco text, cidade_atual text, lat numeric, lng numeric,
  observacoes text, criado_por uuid default auth.uid(), criado_em timestamptz default now()
);

create table negocios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes on delete cascade, titulo text not null,
  servico text, valor numeric default 0, etapa text default 'Novo Lead',
  probabilidade int default 10, origem text, campanha text, descricao text,
  responsavel uuid default auth.uid(), criado_em timestamptz default now()
);

create table vendas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes on delete cascade, negocio_id uuid references negocios on delete set null,
  data_venda date default current_date, servico text, destino text,
  valor numeric not null default 0, comissao_pct numeric default 10,
  forma_pagamento text, observacoes text,
  vendedor uuid default auth.uid(), criado_em timestamptz default now()
);

-- voo, hospedagem, transporte, cruzeiro, seguro
create table viagens (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes on delete cascade, venda_id uuid references vendas on delete set null,
  tipo text not null default 'voo' check (tipo in ('voo','hospedagem','transporte','cruzeiro','seguro')),
  destino text, fornecedor text, localizador text, data_ida date, data_volta date,
  status text default 'Pendente', checkin_feito boolean default false, notas text,
  portal_token uuid default gen_random_uuid(), criado_em timestamptz default now()
);

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, descricao text, prioridade text default 'media', status text default 'pendente',
  prazo date, cliente_id uuid references clientes on delete set null, negocio_id uuid references negocios on delete set null,
  responsavel uuid default auth.uid(), criado_em timestamptz default now()
);

create table transacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receita','despesa')), categoria text, descricao text,
  valor numeric not null, data date default current_date, pago boolean default false,
  venda_id uuid references vendas on delete set null, criado_em timestamptz default now()
);

-- Milhas (estrutura base; telas na Fase 2)
create table milhas_contas (
  id uuid primary key default gen_random_uuid(), cliente_id uuid references clientes on delete cascade,
  programa text not null, login text, saldo bigint default 0, observacoes text, criado_em timestamptz default now()
);
create table milhas_cartoes (
  id uuid primary key default gen_random_uuid(), cliente_id uuid references clientes on delete cascade,
  banco text, bandeira text, final text, pontos_por_real numeric, programa text, criado_em timestamptz default now()
);
create table milhas_movimentos (
  id uuid primary key default gen_random_uuid(), conta_id uuid references milhas_contas on delete cascade,
  tipo text check (tipo in ('compra','transferencia','bonus','emissao','venda','expiracao')),
  quantidade bigint not null, custo numeric default 0, data date default current_date,
  agendado boolean default false, descricao text, criado_em timestamptz default now()
);
create table milhas_clubes (
  id uuid primary key default gen_random_uuid(), conta_id uuid references milhas_contas on delete cascade,
  clube text, milhas_mensais bigint, valor_mensal numeric, renovacao date, criado_em timestamptz default now()
);

-- Primeiro usuario vira admin
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, nome, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
          case when (select count(*) from profiles) = 0 then 'admin' else 'vendedor' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and ativo) $$;
create function is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select exists(select 1 from profiles where id = auth.uid() and ativo) $$;

-- RLS: equipe ativa le/escreve; so admin apaga
do $$ declare t text; begin
  foreach t in array array['clientes','negocios','vendas','viagens','tarefas','transacoes','milhas_contas','milhas_cartoes','milhas_movimentos','milhas_clubes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "staff_select" on %I for select using (is_staff())', t);
    execute format('create policy "staff_insert" on %I for insert with check (is_staff())', t);
    execute format('create policy "staff_update" on %I for update using (is_staff())', t);
    execute format('create policy "admin_delete" on %I for delete using (is_admin())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy "ver_perfis" on profiles for select using (is_staff());
create policy "admin_edita_perfis" on profiles for update using (is_admin());

-- Financeiro: so admin e financeiro
drop policy "staff_select" on transacoes; drop policy "staff_insert" on transacoes; drop policy "staff_update" on transacoes;
create policy "fin_all" on transacoes for all
  using (exists(select 1 from profiles where id = auth.uid() and ativo and role in ('admin','financeiro')))
  with check (exists(select 1 from profiles where id = auth.uid() and ativo and role in ('admin','financeiro')));

-- Portal do cliente: acesso por link com token (sem login)
create function portal_viagem(token uuid) returns json language sql security definer set search_path = public as $$
  select json_build_object('cliente', c.nome, 'tipo', v.tipo, 'destino', v.destino, 'fornecedor', v.fornecedor,
    'localizador', v.localizador, 'data_ida', v.data_ida, 'data_volta', v.data_volta, 'status', v.status, 'notas', v.notas)
  from viagens v join clientes c on c.id = v.cliente_id where v.portal_token = token
$$;
grant execute on function portal_viagem(uuid) to anon, authenticated;

-- ================= fase2_milhas =================
-- WIHD CRM - Fase 2 (Milhas). Rode DEPOIS do schema.sql.

alter table milhas_contas add column if not exists custo_milheiro numeric default 25;
alter table milhas_cartoes add column if not exists nome text, add column if not exists limite numeric;
alter table milhas_clubes add column if not exists cliente_id uuid references clientes on delete cascade,
                          add column if not exists programa text;
alter table milhas_movimentos add column if not exists conta_destino uuid references milhas_contas on delete set null,
                              add column if not exists bonus_pct numeric default 0;

create table milhas_emissoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes on delete cascade, programa text, data date default current_date,
  localizador text, origem text, destino text, milhas bigint default 0, taxas numeric default 0,
  valor_mercado numeric default 0, custo_milha numeric, observacoes text, criado_em timestamptz default now()
);

-- Valor padrao da milha (R$ por milha). 0.025 = R$ 25 o milheiro
create table config_app (id int primary key default 1 check (id = 1), valor_milha numeric default 0.025);
insert into config_app default values;

do $$ declare t text; begin
  foreach t in array array['milhas_emissoes','config_app'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "staff_select" on %I for select using (is_staff())', t);
  end loop;
end $$;
create policy "staff_insert" on milhas_emissoes for insert with check (is_staff());
create policy "staff_update" on milhas_emissoes for update using (is_staff());
create policy "admin_delete" on milhas_emissoes for delete using (is_admin());
create policy "admin_config" on config_app for update using (is_admin());

-- Saldo da conta e atualizado automaticamente pelas movimentacoes
-- (quantidade negativa = saida; agendado = ainda nao afeta o saldo)
create function mov_saldo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and not new.agendado then
    update milhas_contas set saldo = saldo + new.quantidade where id = new.conta_id;
  elsif tg_op = 'UPDATE' and old.agendado and not new.agendado then
    update milhas_contas set saldo = saldo + new.quantidade where id = new.conta_id;
  elsif tg_op = 'DELETE' and not old.agendado then
    update milhas_contas set saldo = saldo - old.quantidade where id = old.conta_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger trg_mov_saldo after insert or update or delete on milhas_movimentos
  for each row execute function mov_saldo();

-- ================= fase3_whatsapp =================
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

-- ================= fase4_financeiro =================
-- WIHD CRM - Fase 4 (Comissões e contas a pagar/receber). Rode depois da Fase 3.

-- Contas a pagar/receber: usam a tabela transacoes (despesa = a pagar, receita = a receber)
alter table transacoes add column if not exists vencimento date,
                       add column if not exists pago_em date,
                       add column if not exists cliente_id uuid references clientes on delete set null,
                       add column if not exists fornecedor text;
update transacoes set vencimento = data where vencimento is null;

-- % que o colaborador recebe sobre a comissao que a agencia ganha na venda
alter table profiles add column if not exists comissao_pct numeric default 0;

create table comissoes (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid unique references vendas on delete cascade,
  vendedor_id uuid references profiles on delete set null,
  base numeric not null default 0,      -- comissao da agencia na venda (valor x comissao_pct da venda)
  pct numeric not null default 0,       -- % do vendedor
  valor numeric not null default 0,     -- comissao do vendedor
  status text not null default 'pendente' check (status in ('pendente','paga')),
  pago_em date, criado_em timestamptz default now()
);
alter table comissoes enable row level security;
create policy "ver_comissoes" on comissoes for select using (
  vendedor_id = auth.uid() or exists(select 1 from profiles where id = auth.uid() and ativo and role in ('admin','financeiro')));
create policy "admin_apaga_comissoes" on comissoes for delete using (is_admin());

create function gerar_comissoes() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists(select 1 from profiles where id = auth.uid() and ativo and role in ('admin','financeiro')) then
    raise exception 'sem permissao';
  end if;
  insert into comissoes(venda_id, vendedor_id, base, pct, valor)
  select v.id, v.vendedor, v.valor * coalesce(v.comissao_pct, 10) / 100, coalesce(p.comissao_pct, 0),
         v.valor * coalesce(v.comissao_pct, 10) / 100 * coalesce(p.comissao_pct, 0) / 100
    from vendas v left join profiles p on p.id = v.vendedor
   where v.valor > 0 and not exists(select 1 from comissoes c where c.venda_id = v.id);
  get diagnostics n = row_count;
  return n;
end $$;

-- Paga a comissao e lanca a saida no caixa (tudo numa so operacao)
create function pagar_comissao(cid uuid) returns void language plpgsql security definer set search_path = public as $$
declare c comissoes;
begin
  if not exists(select 1 from profiles where id = auth.uid() and ativo and role in ('admin','financeiro')) then
    raise exception 'sem permissao';
  end if;
  update comissoes set status = 'paga', pago_em = current_date where id = cid and status = 'pendente' returning * into c;
  if c.id is null then return; end if;
  insert into transacoes(tipo, categoria, descricao, valor, data, vencimento, pago, pago_em, venda_id)
  values ('despesa', 'Comissão vendedor', 'Comissão de vendedor', c.valor, current_date, current_date, true, current_date, c.venda_id);
end $$;

-- ================= fase5_funis =================
-- WIHD CRM - Fase 5 (Funis estilo Volly). Rode depois da Fase 4.
alter table negocios add column if not exists funil text default 'Funil Comercial';
update negocios set funil = 'Funil Comercial' where funil is null;
-- Converte as etapas antigas para as novas
update negocios set etapa = case etapa
  when 'Novo Lead' then 'Novo Contato' when 'Qualificado' then 'Em Cotação'
  when 'Negociação' then 'Proposta Enviada' when 'Fechado (Ganho)' then 'Aprovado' else etapa end;
alter table negocios alter column etapa set default 'Novo Contato';

-- ================= fase6_acompanhamentos =================
-- WIHD CRM - Fase 6 (Acompanhamentos por tipo). Rode depois da Fase 5.
alter table viagens drop constraint if exists viagens_tipo_check;
alter table viagens add constraint viagens_tipo_check
  check (tipo in ('voo','hospedagem','transporte','cruzeiro','seguro','adicional'));
alter table viagens add column if not exists valor numeric default 0,
                    add column if not exists passageiros int default 1,
                    add column if not exists detalhe text;   -- nº do voo, quarto, cabine, apólice...

-- ================= fase7_vendas =================
-- WIHD CRM - Fase 7 (Vendas com custo, lucro e margem). Rode depois da Fase 6.
alter table vendas add column if not exists localizador text,
                   add column if not exists tipo_venda text,        -- milhas_proprias | milhas_terceiros | dinheiro | pacote
                   add column if not exists milhas bigint default 0, -- milhas usadas na emissao
                   add column if not exists cpm numeric,             -- custo por milheiro (R$); vazio = usa o padrao de config_app
                   add column if not exists taxas numeric default 0,
                   add column if not exists custo_outros numeric default 0,
                   add column if not exists pgto_status text default 'Pendente';

-- ================= fase8_financeiro2 =================
-- WIHD CRM - Fase 8 (recebimento ligado à venda + folha). Rode depois da Fase 7.

-- Folha de pagamento (admin e financeiro)
create table folha_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null, cargo text, valor numeric not null default 0,
  dia_pagto int default 5, ativo boolean default true, criado_em timestamptz default now()
);
alter table folha_itens enable row level security;
create policy "fin_folha" on folha_itens for all
  using (exists(select 1 from profiles where id = auth.uid() and ativo and role in ('admin','financeiro')))
  with check (exists(select 1 from profiles where id = auth.uid() and ativo and role in ('admin','financeiro')));

-- Situacao do pagamento da venda acompanha as parcelas recebidas em "A receber"
create function sync_pgto_venda() returns trigger language plpgsql security definer set search_path = public as $$
declare vid uuid; t text; v_pago numeric; v_tot int;
begin
  if tg_op = 'DELETE' then vid := old.venda_id; t := old.tipo; else vid := new.venda_id; t := new.tipo; end if;
  if vid is not null and t = 'receita' then
    select coalesce(sum(valor) filter (where pago), 0), count(*) into v_pago, v_tot
      from transacoes where venda_id = vid and tipo = 'receita';
    update vendas set pgto_status = case
        when v_tot = 0 then pgto_status
        when v_pago >= valor - 0.005 then 'Pago'
        when v_pago > 0 then 'Parcial' else 'Pendente' end
      where id = vid;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger trg_sync_pgto after insert or update or delete on transacoes
  for each row execute function sync_pgto_venda();

-- ================= fase9_contas_faturas =================
-- WIHD CRM - Fase 9 (Contas e Faturas do financeiro). Rode depois da Fase 8.
create table contas_fin (
  id uuid primary key default gen_random_uuid(),
  nome text not null, tipo text default 'corrente',      -- corrente | poupanca | caixa | investimento
  banco text, saldo_inicial numeric default 0, ativo boolean default true, criado_em timestamptz default now()
);
create table cartoes_fin (
  id uuid primary key default gen_random_uuid(),
  nome text not null, banco text, final text, limite numeric default 0,
  dia_fechamento int default 25, dia_vencimento int default 5, ativo boolean default true, criado_em timestamptz default now()
);
alter table transacoes add column if not exists conta_id uuid references contas_fin on delete set null,
                       add column if not exists cartao_id uuid references cartoes_fin on delete set null;
do $$ declare t text; begin
  foreach t in array array['contas_fin','cartoes_fin'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "fin_all" on %I for all using (exists(select 1 from profiles where id = auth.uid() and ativo and role in (''admin'',''financeiro''))) with check (exists(select 1 from profiles where id = auth.uid() and ativo and role in (''admin'',''financeiro'')))', t);
  end loop;
end $$;
