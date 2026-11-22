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
