-- WIHD CRM - Fase 5 (Funis estilo Volly). Rode depois da Fase 4.
alter table negocios add column if not exists funil text default 'Funil Comercial';
update negocios set funil = 'Funil Comercial' where funil is null;
-- Converte as etapas antigas para as novas
update negocios set etapa = case etapa
  when 'Novo Lead' then 'Novo Contato' when 'Qualificado' then 'Em Cotação'
  when 'Negociação' then 'Proposta Enviada' when 'Fechado (Ganho)' then 'Aprovado' else etapa end;
alter table negocios alter column etapa set default 'Novo Contato';
