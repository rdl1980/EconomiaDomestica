-- =============================================================================
-- Economia Domestica - schema core di riferimento (Postgres / Supabase)
--
-- STATO: DESIGN. Non e' ancora una migration applicata: serve a fissare il
-- modello dati concordato. Diventera' la migration 000 in packages/db a M0.
--
-- Convenzioni:
--   importi        numeric(12,2)   mai float
--   prezzi unitari numeric(12,4)   esistono tariffe tipo 0,0295 EUR/kWh
--   quantita'      numeric(12,3)   grammi
--   ogni tabella   household_id    radice dell'isolamento RLS
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fuzzy match su descrizioni e insegne

-- ---------------------------------------------------------------- CORE: nucleo

create table household (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    char(3) not null default 'EUR',
  timezone    text not null default 'Europe/Rome',
  created_at  timestamptz not null default now()
);

create table member (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  user_id       uuid not null,                      -- auth.users.id
  display_name  text not null,
  role          text not null default 'adult'
                check (role in ('owner', 'adult', 'viewer')),
  created_at    timestamptz not null default now(),
  unique (household_id, user_id)
);
create index on member (user_id);

-- ------------------------------------------------------------ CORE: categorie
-- household_id NULL = categoria di sistema, condivisa da tutti.

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
  is_system     boolean not null default false
);
create unique index on category
  (coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- --------------------------------------------------------------- CORE: vendor
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
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index on vendor (household_id, type);
create index on vendor using gin (name gin_trgm_ops);

-- ------------------------------------------------------------ CORE: documenti
-- Il file caricato + lo stato della pipeline + il draft grezzo cosi' com'era.

create table document (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references household(id) on delete cascade,
  storage_path        text,                     -- null per source = 'manual'
  mime_type           text,
  byte_size           bigint,
  sha256              text,                     -- deduplica dello stesso file
  source              text not null
                      check (source in ('camera','upload','json_import','manual')),
  status              text not null default 'pending'
                      check (status in ('pending','parsing','parsed','confirmed',
                                        'failed','discarded')),
  draft               jsonb,                    -- ReceiptDraft come ricevuto
  extraction_provider text,                     -- 'vision:<modello>' | 'external'
  error               text,
  created_by          uuid references member(id),
  created_at          timestamptz not null default now(),
  confirmed_at        timestamptz
);
create unique index on document (household_id, sha256) where sha256 is not null;
create index on document (household_id, status, created_at desc);

-- ---------------------------------------------------------------- CORE: ledger
-- Unico punto di verita' per il denaro. Ogni modulo scrive qui.

create table transaction (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  module          text not null default 'spesa'
                  check (module in ('spesa','utenze','abbonamenti','altro')),
  vendor_id       uuid references vendor(id),
  document_id     uuid references document(id) on delete set null,
  occurred_at     timestamptz not null,
  total_amount    numeric(12,2) not null,
  discount_total  numeric(12,2) not null default 0,
  currency        char(3) not null default 'EUR',
  payment_method  text,
  notes           text,
  created_by      uuid references member(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on transaction (household_id, occurred_at desc);
create index on transaction (household_id, vendor_id, occurred_at desc);
create index on transaction (household_id, module, occurred_at desc);

create table line_item (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references household(id) on delete cascade,
  transaction_id   uuid not null references transaction(id) on delete cascade,
  line_no          int not null,
  raw_description  text not null,        -- come stampato: base dell'apprendimento
  product_id       uuid,                 -- fk aggiunta sotto, col modulo spesa
  category_id      uuid references category(id),
  quantity         numeric(12,3) not null,
  unit             text not null check (unit in ('pcs','kg','l')),
  unit_price       numeric(12,4) not null,
  gross_amount     numeric(12,2) not null,
  discount_amount  numeric(12,2) not null default 0,
  net_amount       numeric(12,2) not null,
  vat_rate         numeric(5,2),
  needs_review     boolean not null default false,
  meta             jsonb not null default '{}'::jsonb,
  unique (transaction_id, line_no)
);
create index on line_item (household_id, product_id);
create index on line_item (household_id, category_id);

-- --------------------------------------------------------------- MODULO SPESA

create table product (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references household(id) on delete cascade,
  name                 text not null,
  brand                text,
  default_unit         text not null default 'pcs'
                       check (default_unit in ('pcs','kg','l')),
  default_category_id  uuid references category(id),
  package_size         numeric(12,3),    -- per normalizzare i prezzi al kg/L
  package_unit         text check (package_unit in ('kg','l','pcs')),
  ean                  text,
  created_at           timestamptz not null default now()
);
create index on product using gin (name gin_trgm_ops);

alter table line_item
  add constraint line_item_product_fk
  foreign key (product_id) references product(id) on delete set null;

-- Il motore di apprendimento: ogni correzione dell'utente scrive qui.
-- vendor_id NULL = alias globale, valido su tutte le insegne.
create table product_alias (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  vendor_id     uuid references vendor(id) on delete cascade,
  normalized    text not null,           -- raw_description normalizzata
  product_id    uuid not null references product(id) on delete cascade,
  confidence    numeric(3,2) not null default 1.0,
  source        text not null default 'user'
                check (source in ('user','auto','seed')),
  hit_count     int not null default 0,
  created_at    timestamptz not null default now()
);
create unique index on product_alias
  (household_id,
   coalesce(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
   normalized);

-- Storia dei prezzi: si popola alla conferma, non si ricalcola al volo.
-- unit_price_normalized rende confrontabili pezzature diverse fra loro.
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
create index on price_observation (household_id, product_id, observed_on desc);
create index on price_observation (household_id, product_id, vendor_id, observed_on desc);

-- ------------------------------------------------------------------------ RLS
-- Stessa forma su ogni tabella: visibile se sei membro dell'household.
-- Le policy complete arrivano con la migration; qui si fissa il principio.

create or replace function current_household_ids()
returns setof uuid
language sql
stable
security definer
as 'select household_id from member where user_id = auth.uid()';

-- Esempio, da replicare su tutte le tabelle con household_id:
--
--   alter table transaction enable row level security;
--   create policy household_rw on transaction
--     using      (household_id in (select current_household_ids()))
--     with check (household_id in (select current_household_ids()));
