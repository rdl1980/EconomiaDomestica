-- =============================================================================
-- 0001 - Schema core + modulo spesa
--
-- Convenzioni:
--   importi        numeric(12,2)
--   prezzi unitari numeric(12,4)   esistono tariffe tipo 0,0295 EUR/kWh
--   quantita'      numeric(12,3)   grammi, millilitri
--   ogni tabella   household_id    radice dell'isolamento RLS
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- --------------------------------------------------------------- utility

create or replace function set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- ------------------------------------------------------------ nucleo domestico

create table household (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    char(3) not null default 'EUR',
  timezone    text not null default 'Europe/Rome',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger household_updated_at before update on household
  for each row execute function set_updated_at();

create table member (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  role          text not null default 'adult'
                check (role in ('owner', 'adult', 'viewer')),
  color         text,
  created_at    timestamptz not null default now(),
  unique (household_id, user_id)
);
create index member_user_idx on member (user_id);

-- Inviti: il modo con cui un secondo adulto entra nell'household senza che
-- nessuno debba condividere una password.
create table household_invite (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  code          text not null unique,
  created_by    uuid references member(id) on delete set null,
  role          text not null default 'adult' check (role in ('adult', 'viewer')),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index household_invite_household_idx on household_invite (household_id);

-- ------------------------------------------------------------------ categorie
-- household_id NULL = categoria di sistema, condivisa da tutti gli household.

create table category (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid references household(id) on delete cascade,
  parent_id     uuid references category(id) on delete cascade,
  name          text not null,
  slug          text not null,
  domain        text not null default 'spesa'
                check (domain in ('spesa','utenze','casa','trasporti','salute','tempo_libero','altro')),
  icon          text,
  color         text,
  sort_order    int not null default 0,
  is_system     boolean not null default false,
  created_at    timestamptz not null default now()
);
-- Uno slug per household; le categorie di sistema occupano lo "slot NULL".
create unique index category_slug_uidx
  on category (coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
create index category_household_idx on category (household_id);
create index category_parent_idx on category (parent_id);

-- --------------------------------------------------------------------- vendor
-- Una sola entita' per supermercati, fornitori luce, operatori telefonici.

create table vendor (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  name          text not null,
  type          text not null default 'supermercato'
                check (type in ('supermercato','negozio','energia','gas','acqua',
                                'telefonia','internet','servizi','altro')),
  chain         text,
  address       text,
  city          text,
  vat_number    text,
  color         text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index vendor_household_type_idx on vendor (household_id, type);
create index vendor_name_trgm_idx on vendor using gin (name gin_trgm_ops);
create trigger vendor_updated_at before update on vendor
  for each row execute function set_updated_at();

-- ------------------------------------------------------------------ documenti
-- Il file caricato + lo stato della pipeline + il draft grezzo cosi' com'era.

create table document (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references household(id) on delete cascade,
  storage_path        text,
  mime_type           text,
  byte_size           bigint,
  sha256              text,
  source              text not null
                      check (source in ('camera','upload','json_import','manual')),
  status              text not null default 'pending'
                      check (status in ('pending','parsing','parsed','confirmed',
                                        'failed','discarded')),
  draft               jsonb,
  extraction_provider text,
  error               text,
  created_by          uuid references member(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  confirmed_at        timestamptz
);
-- Lo stesso file non entra due volte.
create unique index document_sha_uidx on document (household_id, sha256)
  where sha256 is not null;
create index document_status_idx on document (household_id, status, created_at desc);
create trigger document_updated_at before update on document
  for each row execute function set_updated_at();

-- --------------------------------------------------------------------- ledger
-- Unico punto di verita' per il denaro: ogni modulo scrive qui.

create table transaction (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  module          text not null default 'spesa'
                  check (module in ('spesa','utenze','abbonamenti','altro')),
  vendor_id       uuid references vendor(id) on delete set null,
  document_id     uuid references document(id) on delete set null,
  occurred_at     timestamptz not null,
  total_amount    numeric(12,2) not null,
  discount_total  numeric(12,2) not null default 0,
  currency        char(3) not null default 'EUR',
  payment_method  text,
  notes           text,
  created_by      uuid references member(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index transaction_when_idx on transaction (household_id, occurred_at desc);
create index transaction_vendor_idx on transaction (household_id, vendor_id, occurred_at desc);
create index transaction_module_idx on transaction (household_id, module, occurred_at desc);
create index transaction_document_idx on transaction (document_id);
create trigger transaction_updated_at before update on transaction
  for each row execute function set_updated_at();

create table line_item (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references household(id) on delete cascade,
  transaction_id   uuid not null references transaction(id) on delete cascade,
  line_no          int not null,
  raw_description  text not null,
  product_id       uuid,
  category_id      uuid references category(id) on delete set null,
  quantity         numeric(12,3) not null,
  unit             text not null check (unit in ('pcs','kg','l')),
  unit_price       numeric(12,4) not null,
  gross_amount     numeric(12,2) not null,
  discount_amount  numeric(12,2) not null default 0,
  net_amount       numeric(12,2) not null,
  vat_rate         numeric(5,2),
  needs_review     boolean not null default false,
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (transaction_id, line_no)
);
create index line_item_product_idx on line_item (household_id, product_id);
create index line_item_category_idx on line_item (household_id, category_id);
create index line_item_review_idx on line_item (household_id) where needs_review;
create index line_item_desc_trgm_idx on line_item using gin (raw_description gin_trgm_ops);

-- ---------------------------------------------------------------- modulo spesa

create table product (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references household(id) on delete cascade,
  name                 text not null,
  brand                text,
  default_unit         text not null default 'pcs'
                       check (default_unit in ('pcs','kg','l')),
  default_category_id  uuid references category(id) on delete set null,
  package_size         numeric(12,3),
  package_unit         text check (package_unit in ('kg','l','pcs')),
  ean                  text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index product_household_idx on product (household_id);
create index product_name_trgm_idx on product using gin (name gin_trgm_ops);
create trigger product_updated_at before update on product
  for each row execute function set_updated_at();

alter table line_item
  add constraint line_item_product_fk
  foreign key (product_id) references product(id) on delete set null;

-- Il motore di apprendimento: ogni correzione dell'utente scrive qui.
-- vendor_id NULL = alias globale, valido su qualunque insegna.
create table product_alias (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  vendor_id     uuid references vendor(id) on delete cascade,
  normalized    text not null,
  product_id    uuid not null references product(id) on delete cascade,
  confidence    numeric(3,2) not null default 1.0,
  source        text not null default 'user' check (source in ('user','auto','seed')),
  hit_count     int not null default 0,
  created_at    timestamptz not null default now()
);
create unique index product_alias_uidx on product_alias
  (household_id,
   coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
   normalized);
create index product_alias_product_idx on product_alias (product_id);

-- Storico prezzi: si popola alla conferma di un documento, non si ricalcola.
create table price_observation (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references household(id) on delete cascade,
  product_id             uuid not null references product(id) on delete cascade,
  vendor_id              uuid references vendor(id) on delete set null,
  observed_on            date not null,
  normalized_unit        text not null check (normalized_unit in ('kg','l','pcs')),
  unit_price_normalized  numeric(12,4) not null,
  was_discounted         boolean not null default false,
  line_item_id           uuid references line_item(id) on delete cascade,
  created_at             timestamptz not null default now()
);
create index price_obs_product_idx on price_observation (household_id, product_id, observed_on desc);
create index price_obs_vendor_idx on price_observation (household_id, product_id, vendor_id, observed_on desc);
