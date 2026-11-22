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
