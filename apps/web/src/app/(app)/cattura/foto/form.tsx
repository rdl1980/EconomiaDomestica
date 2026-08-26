'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Camera, ImageUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractFromPhoto, type PhotoResult } from '@/lib/receipts/photo-actions';

const INITIAL: PhotoResult = {};

/** Lato lungo massimo dell'immagine inviata. */
const MAX_EDGE = 2000;

/**
 * Ridimensiona e converte in JPEG prima dell'invio.
 *
 * Tre motivi: le foto da telefono arrivano anche a 8 MB e supererebbero i limiti
 * della server action; l'estrazione non migliora oltre i 2000 px di lato; e la
 * conversione risolve l'HEIC di iPhone, che l'API non accetta ma che il browser
 * sa già decodificare quando lo disegna su canvas.
 */
async function prepareImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) return file;

  return new File([blob], 'scontrino.jpg', { type: 'image/jpeg' });
}

function SubmitButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending || !ready}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> Sto leggendo lo scontrino…
        </>
      ) : (
        <>
          <Camera /> Leggi e rivedi
        </>
      )}
    </Button>
  );
}

export function PhotoForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState(extractFromPhoto, INITIAL);
  const [preview, setPreview] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      // Il file preparato sostituisce l'originale nell'input che verrà inviato.
      const transfer = new DataTransfer();
      transfer.items.add(prepared);
      if (hiddenRef.current) hiddenRef.current.files = transfer.files;

      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(prepared);
      });
      setReady(true);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePick}
      />
      {/* Campo effettivamente inviato: contiene l'immagine già ridimensionata. */}
      <input ref={hiddenRef} type="file" name="photo" className="hidden" />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--radius-card)] border-2 border-dashed border-border bg-surface-2 transition-colors hover:border-primary"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Anteprima dello scontrino" className="size-full object-contain" />
        ) : preparing ? (
          <Loader2 className="size-8 animate-spin text-fg-subtle" />
        ) : (
          <>
            <ImageUp className="size-9 text-fg-subtle" />
            <span className="text-sm font-medium text-fg-muted">Scatta o scegli una foto</span>
            <span className="text-xs text-fg-subtle">JPEG, PNG o WebP</span>
          </>
        )}
      </button>

      {preview ? (
        <Button type="button" variant="ghost" size="sm" full onClick={() => inputRef.current?.click()}>
          <RefreshCw /> Cambia foto
        </Button>
      ) : null}

      {state.error ? (
        <div className="space-y-2 rounded-[var(--radius-card)] bg-negative-soft p-4">
          <p className="text-xs leading-relaxed text-negative">{state.error}</p>
          {state.issues?.length ? (
            <ul className="space-y-0.5">
              {state.issues.map((issue) => (
                <li key={issue} className="font-mono text-[11px] text-negative">
                  {issue}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2 pt-1">
            <Button asChild variant="secondary" size="sm">
              <Link href="/cattura/manuale">Inserisci a mano</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/cattura/json">Importa JSON</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {enabled ? <SubmitButton ready={ready} /> : null}
    </form>
  );
}
