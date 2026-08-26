'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/primitives';
import { importJsonDraft, type ImportResult } from '@/lib/receipts/actions';

const INITIAL: ImportResult = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending || disabled}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending ? 'Verifico il contratto…' : 'Importa e rivedi'}
    </Button>
  );
}

export function JsonImportForm() {
  const [state, action] = useActionState(importJsonDraft, INITIAL);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="space-y-4">
      <Field label="Contenuto JSON" error={state.error}>
        <Textarea
          name="json"
          rows={10}
          spellCheck={false}
          placeholder={'{\n  "schema_version": "1.0",\n  "source": "external",\n  …\n}'}
          className="font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-fg-subtle">oppure</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <input
        ref={fileRef}
        type="file"
        name="file"
        accept="application/json,.json,.txt"
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      <Button type="button" variant="secondary" size="lg" full onClick={() => fileRef.current?.click()}>
        <Upload />
        {fileName ?? 'Scegli un file .json'}
      </Button>

      {state.issues && state.issues.length > 0 ? (
        <div className="space-y-1.5 rounded-[var(--radius-card)] border border-negative-soft bg-negative-soft p-4">
          <p className="text-xs font-medium text-negative">
            Il file non rispetta il contratto. Campi da correggere:
          </p>
          <ul className="space-y-0.5">
            {state.issues.map((issue) => (
              <li key={issue} className="font-mono text-[11px] leading-relaxed text-negative">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SubmitButton disabled={text.trim().length === 0 && fileName === null} />
    </form>
  );
}
