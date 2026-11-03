'use client';

import { CircleCheck, CircleX, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

type Kind = 'ok' | 'error';
interface Toast {
  id: number;
  kind: Kind;
  text: string;
}
const Ctx = createContext<{ ok: (t: string) => void; error: (t: string) => void }>({ ok: () => {}, error: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  const api = { ok: (t: string) => push('ok', t), error: (t: string) => push('error', t) };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-w-md items-start gap-2.5 rounded-md border bg-popover px-3.5 py-2.5 text-sm shadow-pop',
              t.kind === 'error' ? 'border-danger/40' : 'border-success/40',
            )}
          >
            {t.kind === 'error' ? (
              <CircleX className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={1.75} />
            ) : (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.75} />
            )}
            <span className="flex-1">{t.text}</span>
            <button
              aria-label="Cerrar aviso"
              onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
