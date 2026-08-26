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

/**
 * Row -> {Row, Insert, Update}: `K` sono le colonne obbligatorie in insert,
 * `Rels` le foreign key.
 *
 * Le relazioni non sono decorative: supabase-js le usa per tipizzare le select
 * annidate (`vendor:vendor_id(name)`). Senza, il risultato di quelle query
 * diventa `never` e ogni accesso a un campo e' un errore di compilazione.
 */
type Tbl<R, K extends keyof R, Rels extends readonly unknown[] = []> = {
  Row: R;
  Insert: Pick<R, K> & Partial<Omit<R, K>>;
  Update: Partial<R>;
  Relationships: Rels;
};

/** Foreign key a colonna singola verso la chiave primaria di un'altra tabella. */
type Fk<Name extends string, Column extends string, Target extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ['id'];
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

export type UtilityType =
  | 'energia_elettrica'
  | 'gas'
  | 'acqua'
  | 'rifiuti'
  | 'telefonia'
  | 'internet'
  | 'altro';

export type UtilityContractRow = {
  id: Uuid;
  household_id: Uuid;
  vendor_id: Uuid | null;
  type: UtilityType;
  name: string;
  code: string | null;
  consumption_unit: string | null;
  category_id: Uuid | null;
  started_on: DateOnly | null;
  ended_on: DateOnly | null;
  notes: string | null;
  created_at: Timestamptz;
  updated_at: Timestamptz;
};

export type UtilityBillRow = {
  id: Uuid;
  household_id: Uuid;
  contract_id: Uuid;
  transaction_id: Uuid | null;
  document_id: Uuid | null;
  period_start: DateOnly;
  period_end: DateOnly;
  issued_on: DateOnly | null;
  due_on: DateOnly | null;
  amount: Numeric;
  consumption: Numeric | null;
  fixed_amount: Numeric | null;
  variable_amount: Numeric | null;
  taxes_amount: Numeric | null;
  meter_start: Numeric | null;
  meter_end: Numeric | null;
  is_estimated: boolean;
  notes: string | null;
  created_by: Uuid | null;
  created_at: Timestamptz;
  updated_at: Timestamptz;
};

/** Riga della vista di fatto `v_expense_line`: riga di spesa con le sue dimensioni. */
export type ExpenseLineViewRow = {
  line_item_id: Uuid;
  household_id: Uuid;
  transaction_id: Uuid;
  occurred_at: Timestamptz;
  occurred_on: DateOnly;
  module: TransactionModule;
  vendor_id: Uuid | null;
  vendor_name: string | null;
  product_id: Uuid | null;
  product_name: string | null;
  category_id: Uuid | null;
  category_slug: string | null;
  category_name: string | null;
  category_color: string | null;
  root_category_slug: string | null;
  root_category_name: string | null;
  root_category_color: string | null;
  raw_description: string;
  quantity: Numeric;
  unit: Unit;
  unit_price: Numeric;
  net_amount: Numeric;
  discount_amount: Numeric;
  created_by: Uuid | null;
};

export type Database = {
  public: {
    Tables: {
      household: Tbl<HouseholdRow, 'name'>;
      member: Tbl<
        MemberRow,
        'household_id' | 'user_id' | 'display_name',
        [Fk<'member_household_id_fkey', 'household_id', 'household'>]
      >;
      household_invite: Tbl<
        HouseholdInviteRow,
        'household_id' | 'code',
        [
          Fk<'household_invite_household_id_fkey', 'household_id', 'household'>,
          Fk<'household_invite_created_by_fkey', 'created_by', 'member'>,
        ]
      >;
      category: Tbl<
        CategoryRow,
        'name' | 'slug',
        [
          Fk<'category_household_id_fkey', 'household_id', 'household'>,
          Fk<'category_parent_id_fkey', 'parent_id', 'category'>,
        ]
      >;
      vendor: Tbl<
        VendorRow,
        'household_id' | 'name',
        [Fk<'vendor_household_id_fkey', 'household_id', 'household'>]
      >;
      document: Tbl<
        DocumentRow,
        'household_id' | 'source',
        [
          Fk<'document_household_id_fkey', 'household_id', 'household'>,
          Fk<'document_created_by_fkey', 'created_by', 'member'>,
        ]
      >;
      transaction: Tbl<
        TransactionRow,
        'household_id' | 'occurred_at' | 'total_amount',
        [
          Fk<'transaction_household_id_fkey', 'household_id', 'household'>,
          Fk<'transaction_vendor_id_fkey', 'vendor_id', 'vendor'>,
          Fk<'transaction_document_id_fkey', 'document_id', 'document'>,
          Fk<'transaction_created_by_fkey', 'created_by', 'member'>,
        ]
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
        | 'net_amount',
        [
          Fk<'line_item_household_id_fkey', 'household_id', 'household'>,
          Fk<'line_item_transaction_id_fkey', 'transaction_id', 'transaction'>,
          Fk<'line_item_product_fk', 'product_id', 'product'>,
          Fk<'line_item_category_id_fkey', 'category_id', 'category'>,
        ]
      >;
      product: Tbl<
        ProductRow,
        'household_id' | 'name',
        [
          Fk<'product_household_id_fkey', 'household_id', 'household'>,
          Fk<'product_default_category_id_fkey', 'default_category_id', 'category'>,
        ]
      >;
      product_alias: Tbl<
        ProductAliasRow,
        'household_id' | 'normalized' | 'product_id',
        [
          Fk<'product_alias_household_id_fkey', 'household_id', 'household'>,
          Fk<'product_alias_vendor_id_fkey', 'vendor_id', 'vendor'>,
          Fk<'product_alias_product_id_fkey', 'product_id', 'product'>,
        ]
      >;
      utility_contract: Tbl<
        UtilityContractRow,
        'household_id' | 'type' | 'name',
        [
          Fk<'utility_contract_household_id_fkey', 'household_id', 'household'>,
          Fk<'utility_contract_vendor_id_fkey', 'vendor_id', 'vendor'>,
          Fk<'utility_contract_category_id_fkey', 'category_id', 'category'>,
        ]
      >;
      utility_bill: Tbl<
        UtilityBillRow,
        'household_id' | 'contract_id' | 'period_start' | 'period_end' | 'amount',
        [
          Fk<'utility_bill_household_id_fkey', 'household_id', 'household'>,
          Fk<'utility_bill_contract_id_fkey', 'contract_id', 'utility_contract'>,
          Fk<'utility_bill_transaction_id_fkey', 'transaction_id', 'transaction'>,
        ]
      >;
      price_observation: Tbl<
        PriceObservationRow,
        | 'household_id'
        | 'product_id'
        | 'observed_on'
        | 'normalized_unit'
        | 'unit_price_normalized',
        [
          Fk<'price_observation_household_id_fkey', 'household_id', 'household'>,
          Fk<'price_observation_product_id_fkey', 'product_id', 'product'>,
          Fk<'price_observation_vendor_id_fkey', 'vendor_id', 'vendor'>,
          Fk<'price_observation_line_item_id_fkey', 'line_item_id', 'line_item'>,
        ]
      >;
    };
    Views: {
      v_expense_line: { Row: ExpenseLineViewRow; Relationships: [] };
    };
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
      dashboard_summary: {
        Args: { p_household: Uuid; p_from: Timestamptz; p_to: Timestamptz };
        Returns: {
          total: Numeric;
          transaction_count: number;
          line_count: number;
          average_ticket: Numeric;
          discount_total: Numeric;
          uncategorized_total: Numeric;
        }[];
      };
      spend_by_category: {
        Args: { p_household: Uuid; p_from: Timestamptz; p_to: Timestamptz };
        Returns: {
          slug: string;
          name: string;
          color: string;
          total: Numeric;
          line_count: number;
        }[];
      };
      spend_by_vendor: {
        Args: { p_household: Uuid; p_from: Timestamptz; p_to: Timestamptz };
        Returns: {
          vendor_id: Uuid | null;
          name: string;
          total: Numeric;
          transaction_count: number;
          average_ticket: Numeric;
        }[];
      };
      spend_by_month: {
        Args: { p_household: Uuid; p_months?: number };
        Returns: { month: DateOnly; total: Numeric; transaction_count: number }[];
      };
      product_price_summary: {
        Args: { p_household: Uuid; p_from: DateOnly; p_to: DateOnly; p_limit?: number };
        Returns: {
          product_id: Uuid;
          product_name: string;
          normalized_unit: Unit;
          observations: number;
          vendor_count: number;
          last_price: Numeric | null;
          last_observed_on: DateOnly | null;
          average_price: Numeric | null;
          best_price: Numeric | null;
          best_vendor_id: Uuid | null;
          best_vendor_name: string | null;
          worst_price: Numeric | null;
          spend_total: Numeric;
          potential_saving: Numeric;
        }[];
      };
      product_price_history: {
        Args: { p_household: Uuid; p_product: Uuid };
        Returns: {
          observed_on: DateOnly;
          vendor_id: Uuid | null;
          vendor_name: string;
          unit_price_normalized: Numeric;
          normalized_unit: Unit;
          was_discounted: boolean;
        }[];
      };
      product_price_by_vendor: {
        Args: { p_household: Uuid; p_product: Uuid };
        Returns: {
          vendor_id: Uuid | null;
          vendor_name: string;
          observations: number;
          average_price: Numeric;
          best_price: Numeric;
          last_price: Numeric;
          last_observed_on: DateOnly;
        }[];
      };
      personal_inflation: {
        Args: { p_household: Uuid; p_months?: number };
        Returns: { month: DateOnly; index_value: Numeric | null; product_count: number }[];
      };
      record_utility_bill: {
        Args: {
          p_contract: Uuid;
          p_period_start: DateOnly;
          p_period_end: DateOnly;
          p_amount: number;
          p_consumption?: number | null;
          p_issued_on?: DateOnly | null;
          p_due_on?: DateOnly | null;
          p_fixed?: number | null;
          p_variable?: number | null;
          p_taxes?: number | null;
          p_meter_start?: number | null;
          p_meter_end?: number | null;
          p_is_estimated?: boolean;
          p_notes?: string | null;
        };
        Returns: Uuid;
      };
      utility_series: {
        Args: { p_household: Uuid; p_contract: Uuid };
        Returns: {
          bill_id: Uuid;
          period_start: DateOnly;
          period_end: DateOnly;
          days: number;
          amount: Numeric;
          consumption: Numeric | null;
          unit_cost: Numeric | null;
          daily_amount: Numeric;
          daily_consumption: Numeric | null;
          is_estimated: boolean;
        }[];
      };
      utility_decomposition: {
        Args: { p_household: Uuid; p_contract: Uuid };
        Returns: {
          current_period_start: DateOnly;
          previous_period_start: DateOnly;
          amount_delta: Numeric;
          consumption_effect: Numeric | null;
          price_effect: Numeric | null;
          mixed_effect: Numeric | null;
        }[];
      };
      merge_products: {
        Args: { p_source: Uuid; p_target: Uuid };
        Returns: undefined;
      };
      create_household_invite: {
        Args: { p_household: Uuid; p_role?: 'adult' | 'viewer' };
        Returns: string;
      };
      product_catalog: {
        Args: { p_household: Uuid };
        Returns: {
          product_id: Uuid;
          name: string;
          brand: string | null;
          default_unit: Unit;
          category_slug: string | null;
          category_name: string | null;
          category_color: string | null;
          package_size: Numeric | null;
          package_unit: Unit | null;
          alias_count: number;
          line_count: number;
          spend_total: Numeric;
          last_bought: DateOnly | null;
        }[];
      };
      real_deals: {
        Args: { p_household: Uuid; p_min_observations?: number; p_limit?: number };
        Returns: {
          product_id: Uuid;
          product_name: string;
          vendor_name: string;
          normalized_unit: Unit;
          last_price: Numeric;
          median_price: Numeric;
          discount_ratio: Numeric;
          observed_on: DateOnly;
        }[];
      };
      top_products: {
        Args: {
          p_household: Uuid;
          p_from: Timestamptz;
          p_to: Timestamptz;
          p_limit?: number;
        };
        Returns: {
          product_id: Uuid;
          name: string;
          category_color: string;
          total: Numeric;
          times: number;
          total_quantity: Numeric;
          unit: Unit;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
