/**
 * Tipi del database.
 *
 * Scritti a mano invece che generati dalla CLI Supabase: sono la controparte
 * diretta delle migration in `packages/db/migrations`, e tenerli qui rende
 * esplicito che modificare una tabella significa modificare anche questo file.
 *
 * Nota sulle `type` invece delle `interface`: supabase-js richiede che le righe
 * siano assegnabili a `Record<string, unknown>`. Gli alias di tipo ottengono una
 * index signature implicita, le interface no — con `interface` il client perde i
 * tipi e `rpc()` finisce per accettare `undefined` come argomenti.
 *
 * Nota sui numeri: Postgres restituisce `numeric` come **stringa** via PostgREST,
 * per non perdere precisione. I tipi lo riflettono, e la conversione avviene una
 * volta sola nei mapper (`src/mappers.ts`), mai sparsa nei componenti.
 */

export type Uuid = string;
export type Timestamptz = string;
export type DateOnly = string;
/** numeric(n,m) serializzato da PostgREST. */
export type Numeric = string;

export type Unit = 'pcs' | 'kg' | 'l';
export type MemberRole = 'owner' | 'adult' | 'viewer';
export type CategoryDomain =
  | 'spesa'
  | 'utenze'
  | 'casa'
  | 'trasporti'
  | 'salute'
  | 'tempo_libero'
  | 'altro';
export type VendorType =
  | 'supermercato'
  | 'negozio'
  | 'energia'
  | 'gas'
  | 'acqua'
  | 'telefonia'
  | 'internet'
  | 'servizi'
  | 'altro';
export type DocumentSource = 'camera' | 'upload' | 'json_import' | 'manual';
export type DocumentStatus =
  | 'pending'
  | 'parsing'
  | 'parsed'
  | 'confirmed'
  | 'failed'
  | 'discarded';
export type TransactionModule = 'spesa' | 'utenze' | 'abbonamenti' | 'altro';

/** Row -> {Row, Insert, Update}: `K` sono le colonne obbligatorie in insert. */
type Tbl<R, K extends keyof R> = {
  Row: R;
  Insert: Pick<R, K> & Partial<Omit<R, K>>;
  Update: Partial<R>;
  Relationships: [];
};

export type HouseholdRow = {
  id: Uuid;
  name: string;
  currency: string;
  timezone: string;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export type MemberRow = {
  id: Uuid;
  household_id: Uuid;
  user_id: Uuid;
  display_name: string;
  role: MemberRole;
  color: string | null;
  created_at: Timestamptz;
}

export type HouseholdInviteRow = {
  id: Uuid;
  household_id: Uuid;
  code: string;
  created_by: Uuid | null;
  role: 'adult' | 'viewer';
  expires_at: Timestamptz;
  accepted_at: Timestamptz | null;
  accepted_by: Uuid | null;
  created_at: Timestamptz;
}

export type CategoryRow = {
  id: Uuid;
  household_id: Uuid | null;
  parent_id: Uuid | null;
  name: string;
  slug: string;
  domain: CategoryDomain;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_system: boolean;
  created_at: Timestamptz;
}

export type VendorRow = {
  id: Uuid;
  household_id: Uuid;
  name: string;
  type: VendorType;
  chain: string | null;
  address: string | null;
  city: string | null;
  vat_number: string | null;
  color: string | null;
  meta: Record<string, unknown>;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export type DocumentRow = {
  id: Uuid;
  household_id: Uuid;
  storage_path: string | null;
  mime_type: string | null;
  byte_size: number | null;
  sha256: string | null;
  source: DocumentSource;
  status: DocumentStatus;
  draft: unknown;
  extraction_provider: string | null;
  error: string | null;
  created_by: Uuid | null;
  created_at: Timestamptz;
  updated_at: Timestamptz;
  confirmed_at: Timestamptz | null;
}

export type TransactionRow = {
  id: Uuid;
  household_id: Uuid;
  module: TransactionModule;
  vendor_id: Uuid | null;
  document_id: Uuid | null;
  occurred_at: Timestamptz;
  total_amount: Numeric;
  discount_total: Numeric;
  currency: string;
  payment_method: string | null;
  notes: string | null;
  created_by: Uuid | null;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export type LineItemRow = {
  id: Uuid;
  household_id: Uuid;
  transaction_id: Uuid;
  line_no: number;
  raw_description: string;
  product_id: Uuid | null;
  category_id: Uuid | null;
  quantity: Numeric;
  unit: Unit;
  unit_price: Numeric;
  gross_amount: Numeric;
  discount_amount: Numeric;
  net_amount: Numeric;
  vat_rate: Numeric | null;
  needs_review: boolean;
  meta: Record<string, unknown>;
  created_at: Timestamptz;
}

export type ProductRow = {
  id: Uuid;
  household_id: Uuid;
  name: string;
  brand: string | null;
  default_unit: Unit;
  default_category_id: Uuid | null;
  package_size: Numeric | null;
  package_unit: Unit | null;
  ean: string | null;
  notes: string | null;
  created_at: Timestamptz;
  updated_at: Timestamptz;
}

export type ProductAliasRow = {
  id: Uuid;
  household_id: Uuid;
  vendor_id: Uuid | null;
  normalized: string;
  product_id: Uuid;
  confidence: Numeric;
  source: 'user' | 'auto' | 'seed';
  hit_count: number;
  created_at: Timestamptz;
}

export type PriceObservationRow = {
  id: Uuid;
  household_id: Uuid;
  product_id: Uuid;
  vendor_id: Uuid | null;
  observed_on: DateOnly;
  normalized_unit: Unit;
  unit_price_normalized: Numeric;
  was_discounted: boolean;
  line_item_id: Uuid | null;
  created_at: Timestamptz;
}

export type Database = {
  public: {
    Tables: {
      household: Tbl<HouseholdRow, 'name'>;
      member: Tbl<MemberRow, 'household_id' | 'user_id' | 'display_name'>;
      household_invite: Tbl<HouseholdInviteRow, 'household_id' | 'code'>;
      category: Tbl<CategoryRow, 'name' | 'slug'>;
      vendor: Tbl<VendorRow, 'household_id' | 'name'>;
      document: Tbl<DocumentRow, 'household_id' | 'source'>;
      transaction: Tbl<
        TransactionRow,
        'household_id' | 'occurred_at' | 'total_amount'
      >;
      line_item: Tbl<
        LineItemRow,
        | 'household_id'
        | 'transaction_id'
        | 'line_no'
        | 'raw_description'
        | 'quantity'
        | 'unit'
        | 'unit_price'
        | 'gross_amount'
        | 'net_amount'
      >;
      product: Tbl<ProductRow, 'household_id' | 'name'>;
      product_alias: Tbl<
        ProductAliasRow,
        'household_id' | 'normalized' | 'product_id'
      >;
      price_observation: Tbl<
        PriceObservationRow,
        | 'household_id'
        | 'product_id'
        | 'observed_on'
        | 'normalized_unit'
        | 'unit_price_normalized'
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_household: {
        Args: { p_name: string; p_display_name: string };
        Returns: Uuid;
      };
      accept_household_invite: {
        Args: { p_code: string };
        Returns: Uuid;
      };
      current_household_ids: {
        Args: Record<string, never>;
        Returns: Uuid[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
