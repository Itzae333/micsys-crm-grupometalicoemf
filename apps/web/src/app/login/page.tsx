'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { loginSchema } from '@micsys-crm/shared';
import { api, setToken } from '@/lib/api';
import { Button, ErrorNote, Field, Input } from '@/components/ui/primitives';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setError(new Error(parsed.error.issues[0].message));
    setLoading(true);
    try {
      const r = await api<{ access_token: string }>('/auth/login', { body: parsed.data });
      setToken(r.access_token);
      router.replace('/dashboard');
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_480px]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/cauce-horizontal-oscuro.svg" alt="Cauce" className="h-10 w-auto self-start" />
        <div>
          <p className="font-display text-4xl font-bold leading-tight text-white">
            Cada peso,
            <br />
            en su cauce.
          </p>
          <p className="mt-4 max-w-sm text-sm text-sidebar-foreground/70">
            Clientes, cobros y abonos, y la cuenta exacta donde cayó cada uno.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Administración · Grupo Metálico EMF</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={enviar} className="w-full max-w-sm" noValidate>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cauce-horizontal.svg" alt="Cauce" className="mb-8 h-9 w-auto dark:hidden lg:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cauce-horizontal-oscuro.svg" alt="Cauce" className="mb-8 hidden h-9 w-auto dark:block dark:lg:hidden" />
          <h1 className="font-display text-2xl font-bold">Iniciar sesión</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Entra con tu correo y contraseña.</p>
          <div className="flex flex-col gap-4">
            <Field label="Correo">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Field>
            <Field label="Contraseña">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" loading={loading} className="mt-1 h-10">
              Entrar
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
