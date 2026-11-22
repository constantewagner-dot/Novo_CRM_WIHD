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
