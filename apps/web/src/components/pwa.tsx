'use client';

import { Download, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/primitives';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Registra el service worker (solo en producción, para no estorbar el desarrollo). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin SW la app funciona igual; solo no se podrá instalar */
    });
  }, []);
  return null;
}

/** Botón "Instalar Cauce": usa el aviso nativo si existe; en iPhone explica cómo hacerlo. */
export function InstallButton() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalada, setInstalada] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalada(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const antes = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    };
    const despues = () => setInstalada(true);
    window.addEventListener('beforeinstallprompt', antes);
    window.addEventListener('appinstalled', despues);
    return () => {
      window.removeEventListener('beforeinstallprompt', antes);
      window.removeEventListener('appinstalled', despues);
    };
  }, []);

  if (instalada) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="size-4" strokeWidth={1.75} />
        Cauce está instalada en este dispositivo.
      </p>
    );
  }
  if (evento) {
    return (
      <Button
        variant="outline"
        onClick={async () => {
          await evento.prompt();
          await evento.userChoice;
          setEvento(null);
        }}
      >
        <Download className="size-4" strokeWidth={1.75} />
        Instalar Cauce
      </Button>
    );
  }
  if (ios) {
    return (
      <p className="text-sm text-muted-foreground">
        Para instalar Cauce en tu iPhone: en Safari toca <span className="font-medium text-foreground">Compartir</span> y luego{' '}
        <span className="font-medium text-foreground">Añadir a pantalla de inicio</span>.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      Instálala desde el menú del navegador (“Instalar Cauce” o “Agregar a la pantalla de inicio”). Solo aparece cuando la app se abre desde su dirección
      segura (https).
    </p>
  );
}
