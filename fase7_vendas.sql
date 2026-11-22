-- WIHD CRM - Fase 7 (Vendas com custo, lucro e margem). Rode depois da Fase 6.
alter table vendas add column if not exists localizador text,
                   add column if not exists tipo_venda text,        -- milhas_proprias | milhas_terceiros | dinheiro | pacote
                   add column if not exists milhas bigint default 0, -- milhas usadas na emissao
                   add column if not exists cpm numeric,             -- custo por milheiro (R$); vazio = usa o padrao de config_app
                   add column if not exists taxas numeric default 0,
                   add column if not exists custo_outros numeric default 0,
                   add column if not exists pgto_status text default 'Pendente';
