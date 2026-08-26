-- =============================================================================
-- 0005 - Intelligenza sui prezzi
--
-- E' la parte che rende l'app diversa da un foglio di calcolo: non "quanto ho
-- speso" ma "quanto sto pagando, rispetto a quanto potrei pagare".
--
-- Tutto poggia su price_observation, che conserva il prezzo **normalizzato**
-- (EUR/kg, EUR/L, EUR/pz). Senza normalizzazione una busta da 500 g e una da
-- 1 kg non sarebbero confrontabili e ogni conclusione sarebbe sbagliata.
--
-- Come sopra: SECURITY INVOKER, la RLS resta l'unica autorizzazione.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Riepilogo per prodotto: dove costa meno, quanto lo pago in media, quanto
-- potrei risparmiare.
-- -----------------------------------------------------------------------------

create or replace function product_price_summary(
  p_household uuid,
  p_from date,
  p_to date,
  p_limit int default 50
)
returns table (
  product_id uuid,
  product_name text,
  normalized_unit text,
  observations bigint,
  vendor_count bigint,
  last_price numeric,
  last_observed_on date,
  average_price numeric,
  best_price numeric,
  best_vendor_id uuid,
  best_vendor_name text,
  worst_price numeric,
  spend_total numeric,
  -- Stima: quota di spesa che sarebbe rimasta in tasca comprando sempre il
  -- prodotto al prezzo migliore osservato. E' un'approssimazione (assume che il
  -- prezzo migliore fosse disponibile ogni volta), quindi va presentata come
  -- stima e non come numero esatto.
  potential_saving numeric
)
language sql
stable
as $fn$
  with obs as (
    select po.product_id, po.vendor_id, po.observed_on, po.unit_price_normalized,
           po.normalized_unit
    from price_observation po
    where po.household_id = p_household
      and po.observed_on >= p_from
      and po.observed_on <= p_to
  ),
  agg as (
    select
      product_id,
      max(normalized_unit) as normalized_unit,
      count(*) as observations,
      count(distinct vendor_id) as vendor_count,
      avg(unit_price_normalized) as average_price,
      min(unit_price_normalized) as best_price,
      max(unit_price_normalized) as worst_price,
      max(observed_on) as last_observed_on
    from obs
    group by product_id
  ),
  latest as (
    select distinct on (product_id) product_id, unit_price_normalized as last_price
    from obs
    order by product_id, observed_on desc
  ),
  cheapest as (
    select distinct on (product_id) product_id, vendor_id
    from obs
    order by product_id, unit_price_normalized asc, observed_on desc
  ),
  spend as (
    select l.product_id, sum(l.net_amount) as spend_total
    from v_expense_line l
    where l.household_id = p_household
      and l.occurred_on >= p_from
      and l.occurred_on <= p_to
      and l.product_id is not null
    group by l.product_id
  )
  select
    a.product_id,
    p.name,
    a.normalized_unit,
    a.observations,
    a.vendor_count,
    l.last_price,
    a.last_observed_on,
    round(a.average_price, 4),
    a.best_price,
    c.vendor_id,
    v.name,
    a.worst_price,
    coalesce(s.spend_total, 0),
    case
      when a.average_price is null or a.average_price = 0 then 0
      else round(coalesce(s.spend_total, 0) * (1 - a.best_price / a.average_price), 2)
    end
  from agg a
  join product p on p.id = a.product_id
  left join latest l on l.product_id = a.product_id
  left join cheapest c on c.product_id = a.product_id
  left join vendor v on v.id = c.vendor_id
  left join spend s on s.product_id = a.product_id
  order by 14 desc, 13 desc
  limit p_limit;
$fn$;

-- -----------------------------------------------------------------------------
-- Storia prezzi di un singolo prodotto
-- -----------------------------------------------------------------------------

create or replace function product_price_history(
  p_household uuid,
  p_product uuid
)
returns table (
  observed_on date,
  vendor_id uuid,
  vendor_name text,
  unit_price_normalized numeric,
  normalized_unit text,
  was_discounted boolean
)
language sql
stable
as $fn$
  select
    po.observed_on,
    po.vendor_id,
    coalesce(v.name, 'Senza insegna'),
    po.unit_price_normalized,
    po.normalized_unit,
    po.was_discounted
  from price_observation po
  left join vendor v on v.id = po.vendor_id
  where po.household_id = p_household
    and po.product_id = p_product
  order by po.observed_on;
$fn$;

create or replace function product_price_by_vendor(
  p_household uuid,
  p_product uuid
)
returns table (
  vendor_id uuid,
  vendor_name text,
  observations bigint,
  average_price numeric,
  best_price numeric,
  last_price numeric,
  last_observed_on date
)
language sql
stable
as $fn$
  with obs as (
    select po.vendor_id, po.observed_on, po.unit_price_normalized
    from price_observation po
    where po.household_id = p_household and po.product_id = p_product
  ),
  latest as (
    select distinct on (vendor_id) vendor_id, unit_price_normalized, observed_on
    from obs order by vendor_id, observed_on desc
  )
  select
    o.vendor_id,
    coalesce(v.name, 'Senza insegna'),
    count(*),
    round(avg(o.unit_price_normalized), 4),
    min(o.unit_price_normalized),
    max(l.unit_price_normalized),
    max(l.observed_on)
  from obs o
  left join vendor v on v.id = o.vendor_id
  left join latest l on l.vendor_id is not distinct from o.vendor_id
  group by o.vendor_id, v.name
  order by 4 asc;
$fn$;

-- -----------------------------------------------------------------------------
-- Inflazione personale
--
-- Indice sul paniere reale dell'household, non su quello ISTAT. Per ogni mese
-- si confronta il prezzo medio di ciascun prodotto con il suo prezzo nel primo
-- mese in cui compare, pesando per quanto quel prodotto incide sulla spesa.
--
-- Onestà del dato: si restituisce anche `product_count`, cioe' su quanti
-- prodotti l'indice di quel mese e' effettivamente calcolato. Con tre prodotti
-- l'indice non significa niente, e la UI deve poterlo dire invece di disegnare
-- una linea autorevole sopra il nulla.
-- -----------------------------------------------------------------------------

create or replace function personal_inflation(
  p_household uuid,
  p_months int default 12
)
returns table (month date, index_value numeric, product_count bigint)
language sql
stable
as $fn$
  with monthly as (
    select
      product_id,
      date_trunc('month', observed_on)::date as month,
      avg(unit_price_normalized) as price
    from price_observation
    where household_id = p_household
      and observed_on >= (date_trunc('month', now())::date - ((p_months - 1) || ' months')::interval)
    group by 1, 2
  ),
  base as (
    select distinct on (product_id) product_id, price as base_price
    from monthly
    order by product_id, month
  ),
  weights as (
    select product_id, sum(net_amount) as weight
    from v_expense_line
    where household_id = p_household and product_id is not null
    group by product_id
  ),
  months as (
    select generate_series(
      date_trunc('month', now())::date - ((p_months - 1) || ' months')::interval,
      date_trunc('month', now())::date,
      '1 month'::interval
    )::date as month
  )
  select
    m.month,
    case
      when sum(w.weight) is null or sum(w.weight) = 0 then null
      else round(100 * sum(w.weight * mo.price / b.base_price) / sum(w.weight), 1)
    end,
    count(mo.product_id)
  from months m
  left join monthly mo on mo.month = m.month
  left join base b on b.product_id = mo.product_id and b.base_price > 0
  left join weights w on w.product_id = mo.product_id and w.weight > 0
  group by m.month
  order by m.month;
$fn$;

-- -----------------------------------------------------------------------------
-- Offerte vere
--
-- Un prezzo e' davvero in offerta solo rispetto alla propria storia. Serve un
-- minimo di osservazioni: sotto le quattro, "il prezzo piu' basso mai visto" e'
-- solo "il primo prezzo visto".
-- -----------------------------------------------------------------------------

create or replace function real_deals(
  p_household uuid,
  p_min_observations int default 4,
  p_limit int default 20
)
returns table (
  product_id uuid,
  product_name text,
  vendor_name text,
  normalized_unit text,
  last_price numeric,
  median_price numeric,
  discount_ratio numeric,
  observed_on date
)
language sql
stable
as $fn$
  with stats as (
    select
      product_id,
      count(*) as observations,
      -- percentile_cont restituisce double precision anche su input numeric:
      -- senza il cast, round(x, n) piu' avanti non trova una funzione compatibile.
      (percentile_cont(0.5) within group (order by unit_price_normalized))::numeric
        as median_price,
      max(normalized_unit) as normalized_unit
    from price_observation
    where household_id = p_household
    group by product_id
    having count(*) >= p_min_observations
  ),
  latest as (
    select distinct on (po.product_id)
      po.product_id, po.unit_price_normalized, po.observed_on, po.vendor_id
    from price_observation po
    join stats s on s.product_id = po.product_id
    where po.household_id = p_household
    order by po.product_id, po.observed_on desc
  )
  select
    l.product_id,
    p.name,
    coalesce(v.name, 'Senza insegna'),
    s.normalized_unit,
    l.unit_price_normalized,
    round(s.median_price, 4),
    round(1 - l.unit_price_normalized / nullif(s.median_price, 0), 3),
    l.observed_on
  from latest l
  join stats s on s.product_id = l.product_id
  join product p on p.id = l.product_id
  left join vendor v on v.id = l.vendor_id
  where l.unit_price_normalized < s.median_price * 0.9
  order by 7 desc
  limit p_limit;
$fn$;

grant execute on function product_price_summary(uuid, date, date, int) to authenticated;
grant execute on function product_price_history(uuid, uuid) to authenticated;
grant execute on function product_price_by_vendor(uuid, uuid) to authenticated;
grant execute on function personal_inflation(uuid, int) to authenticated;
grant execute on function real_deals(uuid, int, int) to authenticated;
