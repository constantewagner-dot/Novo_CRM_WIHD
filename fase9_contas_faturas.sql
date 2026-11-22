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
