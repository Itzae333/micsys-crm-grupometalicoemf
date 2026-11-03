'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { CuentaDestino, Ejecutivo, Me, Moneda, Ubicacion } from './types';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me'), staleTime: 60_000 });
export const useUbicaciones = (todas = false) =>
  useQuery({
    queryKey: ['ubicaciones', todas],
    queryFn: () => api<Ubicacion[]>('/ubicaciones', { params: { todas } }),
    staleTime: 60_000,
  });
export const useMonedas = () => useQuery({ queryKey: ['monedas'], queryFn: () => api<Moneda[]>('/monedas') });
export const useCuentasDestino = (soloActivas = false) =>
  useQuery({
    queryKey: ['cuentas-destino', soloActivas],
    queryFn: () => api<CuentaDestino[]>('/cuentas-destino', { params: { activas: soloActivas } }),
  });
export const useEjecutivos = () => useQuery({ queryKey: ['ejecutivos'], queryFn: () => api<Ejecutivo[]>('/ejecutivos') });

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
