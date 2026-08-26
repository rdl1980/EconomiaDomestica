import { describe, expect, it } from 'vitest';
import { receiptDraftJsonSchema } from '../receipt/json-schema';

describe('receiptDraftJsonSchema', () => {
  const schema = receiptDraftJsonSchema() as {
    type: string;
    required: string[];
    additionalProperties: boolean;
    properties: Record<string, { type?: string; items?: unknown }>;
  };

  it('descrive un oggetto chiuso', () => {
    expect(schema.type).toBe('object');
    // Il draft esterno non deve poter portare campi extra.
    expect(schema.additionalProperties).toBe(false);
  });

  it('richiede i campi senza cui uno scontrino non esiste', () => {
    for (const field of ['schema_version', 'source', 'vendor', 'purchased_at', 'total_amount', 'lines']) {
      expect(schema.required).toContain(field);
    }
  });

  it('non richiede i campi che hanno un default', () => {
    // Il modello deve poter omettere currency e warnings invece di inventarli.
    expect(schema.required).not.toContain('currency');
    expect(schema.required).not.toContain('warnings');
  });

  it('espone le righe come array', () => {
    expect(schema.properties.lines?.type).toBe('array');
  });
});
