-- WIHD CRM - Fase 6 (Acompanhamentos por tipo). Rode depois da Fase 5.
alter table viagens drop constraint if exists viagens_tipo_check;
alter table viagens add constraint viagens_tipo_check
  check (tipo in ('voo','hospedagem','transporte','cruzeiro','seguro','adicional'));
alter table viagens add column if not exists valor numeric default 0,
                    add column if not exists passageiros int default 1,
                    add column if not exists detalhe text;   -- nº do voo, quarto, cabine, apólice...
