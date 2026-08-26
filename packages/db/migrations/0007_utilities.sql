-- =============================================================================
-- 0007 - Modulo utenze
--
-- Prova del nove dell'architettura: il modulo aggiunge tabelle proprie per cio'
-- che solo lui capisce (contratti, letture contatore, kWh e smc) ma continua a
-- scrivere `transaction` nel ledger comune. La dashboard totale funziona senza
-- che nessuna delle sue query venga toccata.
--
-- La differenza rispetto alla spesa e' il **consumo**: qui l'euro non basta.
-- "Pago di piu' ma consumo meno" e' una frase che con i soli importi non si puo'
-- nemmeno formulare, ed e' esattamente cio' che si vuole sapere di una bolletta.
-- =============================================================================

create table utility_contract (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  vendor_id     uuid references vendor(id) on delete set null,
  type          text not null
                check (type in ('energia_elettrica','gas','acqua','rifiuti',
                                'telefonia','internet','altro')),
  name          text not null,
  -- POD, PDR, numero di linea: l'identificativo stampato in bolletta.
  code          text,
  -- Unita' del consumo: kWh, smc, mc, GB. Null per i contratti a forfait
  -- (un abbonamento internet senza consumo misurato).
  consumption_unit text,
  category_id   uuid references category(id) on delete set null,
  started_on    date,
  ended_on      date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index utility_contract_household_idx on utility_contract (household_id, type);
create trigger utility_contract_updated_at before update on utility_contract
  for each row execute function set_updated_at();

create table utility_bill (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  contract_id     uuid not null references utility_contract(id) on delete cascade,
  -- Ogni bolletta ha la sua transazione nel ledger comune. On delete set null e
  -- non cascade: cancellare una bolletta non deve far sparire un movimento
  -- gia' contabilizzato senza che nessuno se ne accorga.
  transaction_id  uuid references transaction(id) on delete set null,
  document_id     uuid references document(id) on delete set null,
  period_start    date not null,
  period_end      date not null,
  issued_on       date,
  due_on          date,
  amount          numeric(12,2) not null,
  -- Consumo del periodo, nell'unita' del contratto.
  consumption     numeric(12,3),
  -- Scomposizione, quando la bolletta la riporta: serve a distinguere il costo
  -- che dipende dai consumi da quello che si paga comunque.
  fixed_amount    numeric(12,2),
  variable_amount numeric(12,2),
  taxes_amount    numeric(12,2),
  meter_start     numeric(14,3),
  meter_end       numeric(14,3),
  -- Le bollette stimate non sono dati reali: vanno segnate, perche' il conguaglio
  -- successivo altrimenti sembra un'impennata dei consumi.
  is_estimated    boolean not null default false,
  notes           text,
  created_by      uuid references member(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (period_end >= period_start)
);
create index utility_bill_contract_idx on utility_bill (household_id, contract_id, period_start desc);
create unique index utility_bill_period_uidx on utility_bill (contract_id, period_start, period_end);
create trigger utility_bill_updated_at before update on utility_bill
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: stessa forma delle altre tabelle.
-- -----------------------------------------------------------------------------

alter table utility_contract enable row level security;
alter table utility_bill     enable row level security;

create policy utility_contract_all on utility_contract for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy utility_bill_all on utility_bill for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

-- -----------------------------------------------------------------------------
-- Registrazione atomica di una bolletta.
--
-- Bolletta e movimento devono nascere insieme: una bolletta senza transazione
-- sparirebbe dai totali di casa, una transazione senza bolletta sarebbe una
-- spesa senza spiegazione.
-- -----------------------------------------------------------------------------

create or replace function record_utility_bill(
  p_contract uuid,
  p_period_start date,
  p_period_end date,
  p_amount numeric,
  p_consumption numeric default null,
  p_issued_on date default null,
  p_due_on date default null,
  p_fixed numeric default null,
  p_variable numeric default null,
  p_taxes numeric default null,
  p_meter_start numeric default null,
  p_meter_end numeric default null,
  p_is_estimated boolean default false,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_contract utility_contract%rowtype;
  v_member uuid;
  v_transaction uuid;
  v_bill uuid;
begin
  select * into v_contract from utility_contract where id = p_contract;
  if v_contract.id is null then
    raise exception 'Contratto non trovato';
  end if;

  select id into v_member from member
  where household_id = v_contract.household_id and user_id = auth.uid();

  -- La data del movimento e' la fine del periodo: e' il momento a cui la spesa
  -- si riferisce, non quello in cui la si inserisce.
  insert into transaction (
    household_id, module, vendor_id, occurred_at, total_amount, notes, created_by
  ) values (
    v_contract.household_id, 'utenze', v_contract.vendor_id,
    (p_period_end + interval '1 day' - interval '1 second'),
    p_amount,
    coalesce(p_notes, v_contract.name),
    v_member
  )
  returning id into v_transaction;

  insert into line_item (
    household_id, transaction_id, line_no, raw_description, category_id,
    quantity, unit, unit_price, gross_amount, net_amount
  ) values (
    v_contract.household_id, v_transaction, 1, v_contract.name, v_contract.category_id,
    1, 'pcs', p_amount, p_amount, p_amount
  );

  insert into utility_bill (
    household_id, contract_id, transaction_id, period_start, period_end,
    issued_on, due_on, amount, consumption, fixed_amount, variable_amount,
    taxes_amount, meter_start, meter_end, is_estimated, notes, created_by
  ) values (
    v_contract.household_id, p_contract, v_transaction, p_period_start, p_period_end,
    p_issued_on, p_due_on, p_amount, p_consumption, p_fixed, p_variable,
    p_taxes, p_meter_start, p_meter_end, p_is_estimated, p_notes, v_member
  )
  returning id into v_bill;

  return v_bill;
end;
$fn$;

grant execute on function record_utility_bill(
  uuid, date, date, numeric, numeric, date, date, numeric, numeric, numeric,
  numeric, numeric, boolean, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- Serie storica di un contratto: spesa, consumo e costo unitario.
-- -----------------------------------------------------------------------------

create or replace function utility_series(p_household uuid, p_contract uuid)
returns table (
  bill_id uuid,
  period_start date,
  period_end date,
  days int,
  amount numeric,
  consumption numeric,
  -- Costo per unita' consumata: e' il numero che dice se e' cambiato il prezzo
  -- o il consumo.
  unit_cost numeric,
  daily_amount numeric,
  daily_consumption numeric,
  is_estimated boolean
)
language sql
stable
as $fn$
  select
    b.id,
    b.period_start,
    b.period_end,
    (b.period_end - b.period_start + 1)::int as days,
    b.amount,
    b.consumption,
    case when coalesce(b.consumption, 0) > 0
         then round(b.amount / b.consumption, 4) end,
    round(b.amount / nullif(b.period_end - b.period_start + 1, 0), 2),
    case when b.consumption is not null
         then round(b.consumption / nullif(b.period_end - b.period_start + 1, 0), 3) end,
    b.is_estimated
  from utility_bill b
  where b.household_id = p_household and b.contract_id = p_contract
  order by b.period_start;
$fn$;

-- -----------------------------------------------------------------------------
-- Scomposizione della variazione: quanto e' colpa del prezzo, quanto del consumo.
--
-- Delta_costo = (Delta_quantita' x prezzo_vecchio)     effetto consumo
--             + (Delta_prezzo x quantita'_vecchia)     effetto prezzo
--             + (Delta_quantita' x Delta_prezzo)       effetto incrociato
--
-- E' la domanda che con i soli euro non si puo' porre, e la ragione per cui il
-- modulo registra il consumo e non solo l'importo.
-- -----------------------------------------------------------------------------

create or replace function utility_decomposition(p_household uuid, p_contract uuid)
returns table (
  current_period_start date,
  previous_period_start date,
  amount_delta numeric,
  consumption_effect numeric,
  price_effect numeric,
  mixed_effect numeric
)
language sql
stable
as $fn$
  with periods as (
    select
      period_start,
      amount / nullif(period_end - period_start + 1, 0) as daily_amount,
      consumption / nullif(period_end - period_start + 1, 0) as daily_consumption,
      lag(period_start) over (order by period_start) as prev_start,
      lag(amount / nullif(period_end - period_start + 1, 0))
        over (order by period_start) as prev_daily_amount,
      lag(consumption / nullif(period_end - period_start + 1, 0))
        over (order by period_start) as prev_daily_consumption
    from utility_bill
    where household_id = p_household
      and contract_id = p_contract
      and consumption is not null
      and consumption > 0
  )
  select
    period_start,
    prev_start,
    round(daily_amount - prev_daily_amount, 4),
    round((daily_consumption - prev_daily_consumption)
          * (prev_daily_amount / nullif(prev_daily_consumption, 0)), 4),
    round((daily_amount / nullif(daily_consumption, 0)
           - prev_daily_amount / nullif(prev_daily_consumption, 0))
          * prev_daily_consumption, 4),
    round((daily_consumption - prev_daily_consumption)
          * (daily_amount / nullif(daily_consumption, 0)
             - prev_daily_amount / nullif(prev_daily_consumption, 0)), 4)
  from periods
  where prev_start is not null
  order by period_start desc;
$fn$;

grant execute on function utility_series(uuid, uuid) to authenticated;
grant execute on function utility_decomposition(uuid, uuid) to authenticated;
