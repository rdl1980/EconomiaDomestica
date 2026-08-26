import Link from 'next/link';
import { AlertTriangle, Braces, Camera, PencilLine, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/primitives';
import { relativeDay } from '@/lib/format';
import type { DocumentSource, DocumentStatus } from '@ed/db';

const SOURCE_ICON: Record<DocumentSource, typeof Camera> = {
  camera: Camera,
  upload: Upload,
  json_import: Braces,
  manual: PencilLine,
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  pending: 'in coda',
  parsing: 'lettura in corso',
  parsed: 'da confermare',
  confirmed: 'confermato',
  failed: 'lettura fallita',
  discarded: 'scartato',
};

interface PendingDocument {
  id: string;
  source: DocumentSource;
  status: DocumentStatus;
  draft: unknown;
  created_at: string;
}

/** Estrae insegna e totale dal draft senza rivalidarlo: serve solo per l'anteprima. */
function preview(draft: unknown): { vendor: string; total: string | null } {
  if (draft && typeof draft === 'object') {
    const d = draft as { vendor?: { name?: string }; total_amount?: number };
    return {
      vendor: d.vendor?.name?.trim() || 'Insegna da confermare',
      total: typeof d.total_amount === 'number' ? `${d.total_amount.toFixed(2)} €` : null,
    };
  }
  return { vendor: 'Scontrino', total: null };
}

export function PendingDocuments({ documents }: { documents: PendingDocument[] }) {
  return (
    <ul className="space-y-2">
      {documents.map((doc) => {
        const Icon = SOURCE_ICON[doc.source];
        const { vendor, total } = preview(doc.draft);
        const failed = doc.status === 'failed';

        return (
          <li key={doc.id}>
            <Link href={failed ? '/cattura' : `/revisione/${doc.id}`} className="block">
              <Card className="flex items-center gap-3 p-3.5 transition-all active:scale-[0.99]">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted">
                  {failed ? (
                    <AlertTriangle className="size-4 text-warning" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{vendor}</p>
                  <p className="text-xs text-fg-muted">{relativeDay(doc.created_at)}</p>
                </div>
                {total ? <span className="tabular text-sm text-fg-muted">{total}</span> : null}
                <Badge tone={failed ? 'negative' : 'warning'}>{STATUS_LABEL[doc.status]}</Badge>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
