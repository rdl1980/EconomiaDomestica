-- =============================================================================
-- 0002 - Row Level Security
--
-- Principio unico, ripetuto identico su ogni tabella: un record e' visibile e
-- modificabile se il suo household_id e' fra gli household di cui l'utente
-- corrente e' membro.
--
-- La funzione current_household_ids() e' SECURITY DEFINER di proposito: se
-- interrogasse `member` sotto RLS, la policy su `member` chiamerebbe se stessa
-- e Postgres andrebbe in ricorsione infinita. E' il classico inciampo di questo
-- schema, ed e' il motivo per cui la funzione esiste.
-- =============================================================================

create or replace function current_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select household_id from member where user_id = auth.uid()
$fn$;

revoke all on function current_household_ids() from public;
grant execute on function current_household_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- Creazione dell'household: serve una funzione atomica perche' altrimenti
-- nasce un problema dell'uovo e della gallina. Per inserire un household devi
-- esserne membro, ma per essere membro l'household deve esistere.
-- -----------------------------------------------------------------------------

create or replace function create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_household_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  insert into household (name) values (coalesce(nullif(trim(p_name), ''), 'Casa'))
  returning id into v_household_id;

  insert into member (household_id, user_id, display_name, role)
  values (v_household_id, v_user_id, coalesce(nullif(trim(p_display_name), ''), 'Io'), 'owner');

  return v_household_id;
end;
$fn$;

revoke all on function create_household(text, text) from public;
grant execute on function create_household(text, text) to authenticated;

-- Ingresso di un secondo membro tramite codice invito.
create or replace function accept_household_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_invite household_invite%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  select * into v_invite from household_invite
  where code = upper(trim(p_code)) and accepted_at is null and expires_at > now();

  if not found then
    raise exception 'Codice invito non valido o scaduto';
  end if;

  insert into member (household_id, user_id, display_name, role)
  values (v_invite.household_id, v_user_id,
          coalesce((auth.jwt() ->> 'email'), 'Nuovo membro'), v_invite.role)
  on conflict (household_id, user_id) do nothing;

  update household_invite
  set accepted_at = now(), accepted_by = v_user_id
  where id = v_invite.id;

  return v_invite.household_id;
end;
$fn$;

revoke all on function accept_household_invite(text) from public;
grant execute on function accept_household_invite(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Policy
-- -----------------------------------------------------------------------------

alter table household         enable row level security;
alter table member            enable row level security;
alter table household_invite  enable row level security;
alter table category          enable row level security;
alter table vendor            enable row level security;
alter table document          enable row level security;
alter table transaction       enable row level security;
alter table line_item         enable row level security;
alter table product           enable row level security;
alter table product_alias     enable row level security;
alter table price_observation enable row level security;

-- household: si legge e si modifica solo il proprio. La creazione passa dalla
-- funzione dedicata, quindi qui non serve una policy di insert.
create policy household_select on household for select to authenticated
  using (id in (select current_household_ids()));
create policy household_update on household for update to authenticated
  using (id in (select current_household_ids()))
  with check (id in (select current_household_ids()));

create policy member_select on member for select to authenticated
  using (household_id in (select current_household_ids()));
create policy member_update on member for update to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));
create policy member_delete on member for delete to authenticated
  using (household_id in (select current_household_ids()));

create policy invite_all on household_invite for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

-- Le categorie di sistema (household_id null) sono leggibili da tutti, ma
-- modificabili da nessuno: sono seed condiviso.
create policy category_select on category for select to authenticated
  using (household_id is null or household_id in (select current_household_ids()));
create policy category_write on category for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy vendor_all on vendor for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy document_all on document for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy transaction_all on transaction for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy line_item_all on line_item for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy product_all on product for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy product_alias_all on product_alias for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

create policy price_observation_all on price_observation for all to authenticated
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

-- -----------------------------------------------------------------------------
-- Storage: bucket privato per le foto degli scontrini.
-- Convenzione di path: <household_id>/<document_id>.<ext>
-- La prima cartella del path e' quindi la chiave di autorizzazione.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 15728640,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do nothing;

create policy receipts_read on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]::uuid in (select current_household_ids())
  );

create policy receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]::uuid in (select current_household_ids())
  );

create policy receipts_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1]::uuid in (select current_household_ids())
  );
