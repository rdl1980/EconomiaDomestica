-- =============================================================================
-- 0006 - Manutenzione del catalogo e inviti
--
-- Il meccanismo di apprendimento crea un prodotto per ogni riga non riconosciuta.
-- E' il comportamento giusto, ma produce inevitabilmente doppioni: "Latte PS 1L"
-- e "Latte parzialmente scremato 1L" nascono dallo stesso latte comprato in due
-- negozi che lo stampano diverso.
--
-- Unire due prodotti tocca quattro tabelle e deve riuscire o fallire in blocco,
-- altrimenti si resta con lo storico prezzi spezzato a meta'. Da qui la funzione:
-- PostgREST non espone transazioni multi-statement, plpgsql si'.
-- =============================================================================

create or replace function merge_products(p_source uuid, p_target uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_household uuid;
begin
  if p_source = p_target then
    raise exception 'Sorgente e destinazione coincidono';
  end if;

  -- La RLS filtra gia' le select: se uno dei due non e' visibile, non esiste.
  select household_id into v_household from product where id = p_source;
  if v_household is null then
    raise exception 'Prodotto di origine non trovato';
  end if;

  if not exists (select 1 from product where id = p_target and household_id = v_household) then
    raise exception 'I due prodotti appartengono a household diversi';
  end if;

  update line_item set product_id = p_target where product_id = p_source;
  update price_observation set product_id = p_target where product_id = p_source;

  -- Gli alias della sorgente passano alla destinazione, tranne quelli che
  -- creerebbero un doppione sulla stessa coppia (insegna, descrizione).
  update product_alias a
  set product_id = p_target
  where a.product_id = p_source
    and not exists (
      select 1 from product_alias b
      where b.household_id = a.household_id
        and b.normalized = a.normalized
        and b.vendor_id is not distinct from a.vendor_id
        and b.product_id = p_target
    );

  delete from product_alias where product_id = p_source;
  delete from product where id = p_source;
end;
$fn$;

grant execute on function merge_products(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Inviti: il codice si genera lato database, cosi' e' sempre nello stesso
-- formato e non dipende da quale client lo ha creato.
-- -----------------------------------------------------------------------------

create or replace function create_household_invite(p_household uuid, p_role text default 'adult')
returns text
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  v_code text;
  v_member uuid;
begin
  select id into v_member from member
  where household_id = p_household and user_id = auth.uid();

  if v_member is null then
    raise exception 'Non fai parte di questa casa';
  end if;

  -- Alfabeto senza caratteri ambigui: niente 0/O, 1/I/L. Un codice si detta a
  -- voce o si trascrive da uno schermo, e queste coppie sono il primo errore.
  loop
    v_code := (
      select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                               (random() * 30)::int + 1, 1), '')
      from generate_series(1, 8)
    );
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
    exit when not exists (select 1 from household_invite where code = v_code);
  end loop;

  insert into household_invite (household_id, code, created_by, role)
  values (p_household, v_code, v_member, p_role);

  return v_code;
end;
$fn$;

grant execute on function create_household_invite(uuid, text) to authenticated;

-- Elenco prodotti con quanto sono usati: serve alla schermata di manutenzione
-- per far emergere i doppioni (due prodotti simili, entrambi poco usati).
create or replace function product_catalog(p_household uuid)
returns table (
  product_id uuid,
  name text,
  brand text,
  default_unit text,
  category_slug text,
  category_name text,
  category_color text,
  package_size numeric,
  package_unit text,
  alias_count bigint,
  line_count bigint,
  spend_total numeric,
  last_bought date
)
language sql
stable
as $fn$
  select
    p.id,
    p.name,
    p.brand,
    p.default_unit,
    c.slug,
    c.name,
    c.color,
    p.package_size,
    p.package_unit,
    (select count(*) from product_alias a where a.product_id = p.id),
    (select count(*) from line_item l where l.product_id = p.id),
    coalesce((select sum(l.net_amount) from line_item l where l.product_id = p.id), 0),
    (select max(t.occurred_at::date)
       from line_item l join transaction t on t.id = l.transaction_id
      where l.product_id = p.id)
  from product p
  left join category c on c.id = p.default_category_id
  where p.household_id = p_household
  order by 12 desc, p.name;
$fn$;

grant execute on function product_catalog(uuid) to authenticated;
