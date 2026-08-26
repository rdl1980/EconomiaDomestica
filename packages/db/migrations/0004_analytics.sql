-- =============================================================================
-- 0004 - Analitiche
--
-- Le aggregazioni vivono nel database, non nel client: le stesse metriche
-- serviranno l'app mobile, e riscriverle in TypeScript significherebbe avere
-- due definizioni di "quanto ho speso" destinate a divergere.
--
-- Tutte le funzioni sono SECURITY INVOKER (il default): girano con i permessi
-- di chi chiama, quindi la RLS per household continua ad applicarsi. Non
-- renderle SECURITY DEFINER senza aggiungere un controllo esplicito
-- sull'appartenenza, o diventerebbero una scorciatoia per leggere i dati altrui.
-- =============================================================================

-- Vista di fatto: una riga di scontrino con tutte le sue dimensioni.
-- security_invoker = true e' essenziale: senza, la vista girerebbe con i
-- privilegi di chi l'ha creata e scavalcherebbe la RLS.
create view v_expense_line
with (security_invoker = true)
as
select
  li.id                as line_item_id,
  li.household_id,
  li.transaction_id,
  t.occurred_at,
  (t.occurred_at at time zone coalesce(h.timezone, 'Europe/Rome'))::date as occurred_on,
  t.module,
  t.vendor_id,
  v.name               as vendor_name,
  li.product_id,
  p.name               as product_name,
  li.category_id,
  c.slug               as category_slug,
  c.name               as category_name,
  c.color              as category_color,
  coalesce(root.slug, c.slug) as root_category_slug,
  coalesce(root.name, c.name) as root_category_name,
  coalesce(root.color, c.color) as root_category_color,
  li.raw_description,
  li.quantity,
  li.unit,
  li.unit_price,
  li.net_amount,
  li.discount_amount,
  t.created_by
from line_item li
join transaction t on t.id = li.transaction_id
join household h on h.id = li.household_id
left join vendor v on v.id = t.vendor_id
left join product p on p.id = li.product_id
left join category c on c.id = li.category_id
left join category root on root.id = c.parent_id;

comment on view v_expense_line is
  'Riga di spesa denormalizzata con data locale, insegna, prodotto e categoria (foglia e radice).';

-- -----------------------------------------------------------------------------
-- Riepilogo di periodo
-- -----------------------------------------------------------------------------

create or replace function dashboard_summary(
  p_household uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  total numeric,
  transaction_count bigint,
  line_count bigint,
  average_ticket numeric,
  discount_total numeric,
  -- Quota di spesa senza categoria: se e' alta, ogni grafico per categoria
  -- mente, e la dashboard deve poterlo dire invece di nasconderlo.
  uncategorized_total numeric
)
language sql
stable
as $fn$
  with tx as (
    select id, total_amount, discount_total
    from transaction
    where household_id = p_household
      and occurred_at >= p_from
      and occurred_at < p_to
  ),
  li as (
    select l.net_amount, l.category_id
    from line_item l
    join tx on tx.id = l.transaction_id
  )
  select
    coalesce((select sum(total_amount) from tx), 0),
    (select count(*) from tx),
    (select count(*) from li),
    coalesce((select avg(total_amount) from tx), 0),
    coalesce((select sum(discount_total) from tx), 0),
    coalesce((
      select sum(net_amount) from li
      where category_id is null
         or category_id in (select id from category where slug = 'non-categorizzato')
    ), 0);
$fn$;

-- -----------------------------------------------------------------------------
-- Ripartizioni
-- -----------------------------------------------------------------------------

create or replace function spend_by_category(
  p_household uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (slug text, name text, color text, total numeric, line_count bigint)
language sql
stable
as $fn$
  select
    coalesce(root_category_slug, 'non-categorizzato'),
    coalesce(root_category_name, 'Da categorizzare'),
    coalesce(root_category_color, '#94a3b8'),
    sum(net_amount),
    count(*)
  from v_expense_line
  where household_id = p_household
    and occurred_at >= p_from
    and occurred_at < p_to
  group by 1, 2, 3
  order by 4 desc;
$fn$;

create or replace function spend_by_vendor(
  p_household uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  vendor_id uuid,
  name text,
  total numeric,
  transaction_count bigint,
  average_ticket numeric
)
language sql
stable
as $fn$
  select
    t.vendor_id,
    coalesce(v.name, 'Senza insegna'),
    sum(t.total_amount),
    count(*),
    avg(t.total_amount)
  from transaction t
  left join vendor v on v.id = t.vendor_id
  where t.household_id = p_household
    and t.occurred_at >= p_from
    and t.occurred_at < p_to
  group by 1, 2
  order by 3 desc;
$fn$;

-- Serie mensile completa: i mesi senza spesa restano nel risultato a zero,
-- altrimenti spariscono dal grafico e la linea mente sull'andamento.
create or replace function spend_by_month(
  p_household uuid,
  p_months int default 12
)
returns table (month date, total numeric, transaction_count bigint)
language sql
stable
as $fn$
  with bounds as (
    select date_trunc('month', now())::date as last_month
  ),
  months as (
    select generate_series(
      (select last_month from bounds) - ((p_months - 1) || ' months')::interval,
      (select last_month from bounds),
      '1 month'::interval
    )::date as month
  ),
  spend as (
    select
      date_trunc('month', t.occurred_at at time zone coalesce(h.timezone, 'Europe/Rome'))::date as month,
      sum(t.total_amount) as total,
      count(*) as transaction_count
    from transaction t
    join household h on h.id = t.household_id
    where t.household_id = p_household
    group by 1
  )
  select m.month, coalesce(s.total, 0), coalesce(s.transaction_count, 0)
  from months m
  left join spend s on s.month = m.month
  order by m.month;
$fn$;

create or replace function top_products(
  p_household uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 20
)
returns table (
  product_id uuid,
  name text,
  category_color text,
  total numeric,
  times bigint,
  total_quantity numeric,
  unit text
)
language sql
stable
as $fn$
  select
    product_id,
    coalesce(product_name, raw_description),
    coalesce(category_color, '#94a3b8'),
    sum(net_amount),
    count(*),
    sum(quantity),
    max(unit)
  from v_expense_line
  where household_id = p_household
    and occurred_at >= p_from
    and occurred_at < p_to
    and product_id is not null
  group by 1, 2, 3
  order by 4 desc
  limit p_limit;
$fn$;

grant execute on function dashboard_summary(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function spend_by_category(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function spend_by_vendor(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function spend_by_month(uuid, int) to authenticated;
grant execute on function top_products(uuid, timestamptz, timestamptz, int) to authenticated;
