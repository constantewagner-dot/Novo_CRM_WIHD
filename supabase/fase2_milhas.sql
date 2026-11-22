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
