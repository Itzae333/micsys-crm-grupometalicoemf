'use client';

import { ArrowLeftRight, BarChart3, Ellipsis, HandCoins, Landmark, LayoutDashboard, LogOut, Moon, Plus, Settings, Sun, UserCog, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ROL_LABEL } from '@micsys-crm/shared';
import { clearToken, getToken } from '@/lib/api';
import { useMe } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { InstallButton } from '@/components/pwa';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', Icon: Users },
  { href: '/creditos', label: 'Crédito', Icon: HandCoins },
  { href: '/movimientos', label: 'Movimientos', Icon: ArrowLeftRight },
  { href: '/cuentas', label: 'Cuentas', Icon: Landmark },
  { href: '/reportes', label: 'Reportes', Icon: BarChart3 },
  { href: '/configuracion', label: 'Configuración', Icon: Settings },
];
const NAV_PRINCIPAL = NAV.slice(0, 6);
// En móvil: 4 accesos + botón central; el resto va en "Más"
const NAV_MOVIL = [NAV[0], NAV[1], null, NAV[2], 'mas'] as const;
const NAV_USUARIOS = { href: '/usuarios', label: 'Usuarios', Icon: UserCog };

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Cambiar entre modo claro y oscuro"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={cn('inline-flex size-9 items-center justify-center rounded-md hover:bg-white/10', className)}
    >
      <Sun className="hidden size-4 dark:block" strokeWidth={1.75} />
      <Moon className="size-4 dark:hidden" strokeWidth={1.75} />
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const [mas, setMas] = useState(false);
  const esSuper = me.data?.rol === 'SUPER_ADMIN';
  const NAV_MAS = esSuper ? [NAV[3], NAV[4], NAV[5], NAV_USUARIOS, NAV[6]] : [NAV[3], NAV[4], NAV[5], NAV[6]];

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const salir = () => {
    clearToken();
    qc.clear();
    router.replace('/login');
  };
  const activo = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      {/* Sidebar (escritorio) */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 pb-4 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cauce-horizontal-oscuro.svg" alt="Cauce" className="h-8 w-auto" />
        </div>
        <Link
          href="/movimientos/nuevo"
          className="mx-3 mb-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 dark:bg-primary"
        >
          <Plus className="size-4" strokeWidth={2} />
          Registrar movimiento
        </Link>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Principal">
          {NAV_PRINCIPAL.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={activo(href) ? 'page' : undefined}
              className={cn(
                'flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors',
                activo(href) ? 'bg-white/10 font-medium text-white' : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          {esSuper && (
            <Link
              href="/usuarios"
              aria-current={activo('/usuarios') ? 'page' : undefined}
              className={cn(
                'mb-0.5 flex h-9 items-center gap-2.5 rounded-md px-3 text-sm',
                activo('/usuarios') ? 'bg-white/10 text-white' : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white',
              )}
            >
              <UserCog className="size-4" strokeWidth={1.75} />
              Usuarios
            </Link>
          )}
          <Link
            href="/configuracion"
            aria-current={activo('/configuracion') ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center gap-2.5 rounded-md px-3 text-sm',
              activo('/configuracion') ? 'bg-white/10 text-white' : 'text-sidebar-foreground/80 hover:bg-white/5 hover:text-white',
            )}
          >
            <Settings className="size-4" strokeWidth={1.75} />
            Configuración
          </Link>
          <div className="mt-2 flex items-center justify-between gap-2 px-3">
            <div className="min-w-0 text-xs">
              {me.isLoading ? (
                <Skeleton className="h-4 w-24 bg-white/10" />
              ) : (
                <>
                  <div className="truncate font-medium text-white">{me.data?.nombre}</div>
                  <div className="truncate text-sidebar-foreground/60">{me.data ? ROL_LABEL[me.data.rol] : ''}</div>
                </>
              )}
            </div>
            <div className="flex">
              <ThemeToggle />
              <button
                type="button"
                aria-label="Cerrar sesión"
                onClick={salir}
                className="inline-flex size-9 items-center justify-center rounded-md hover:bg-white/10"
              >
                <LogOut className="size-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Encabezado móvil */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-sidebar px-4 text-sidebar-foreground md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cauce-horizontal-oscuro.svg" alt="Cauce" className="h-6 w-auto" />
          <div className="flex items-center">
            <ThemeToggle />
            <button type="button" aria-label="Cerrar sesión" onClick={salir} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-white/10">
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">{children}</main>

        {/* Barra inferior (móvil) */}
        <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card md:hidden">
          {NAV_MOVIL.map((it) =>
            it === null ? (
              <Link
                key="nuevo"
                href="/movimientos/nuevo"
                aria-label="Registrar movimiento"
                className="relative flex h-14 items-center justify-center"
              >
                <span className="absolute -top-4 inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop">
                  <Plus className="size-6" strokeWidth={2} />
                </span>
              </Link>
            ) : it === 'mas' ? (
              <button
                key="mas"
                type="button"
                onClick={() => setMas(true)}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]',
                  NAV_MAS.some((n) => activo(n.href)) ? 'font-medium text-primary' : 'text-muted-foreground',
                )}
              >
                <Ellipsis className="size-5" strokeWidth={1.75} />
                Más
              </button>
            ) : (
              <Link
                key={it.href}
                href={it.href}
                aria-current={activo(it.href) ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]',
                  activo(it.href) ? 'font-medium text-primary' : 'text-muted-foreground',
                )}
              >
                <it.Icon className="size-5" strokeWidth={1.75} />
                {it.label}
              </Link>
            ),
          )}
        </nav>

        <Dialog open={mas} onOpenChange={setMas} title="Más">
          <ul className="-mx-1 flex flex-col">
            {NAV_MAS.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMas(false)}
                  className="flex h-12 items-center gap-3 rounded-md px-3 text-sm hover:bg-accent"
                >
                  <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t pt-3">
            <InstallButton />
          </div>
        </Dialog>
      </div>
    </div>
  );
}
