'use client';

import { useState } from 'react';
import { useEmpresas, useUbicaciones } from '@/lib/hooks';
import { FilterChip } from '@/components/ui/primitives';

const sel = 'bg-transparent pr-1 text-[13px] font-medium text-foreground focus:outline-none';

/** Estado del filtro Empresa → Ubicación. Al cambiar de empresa se limpia una ubicación que ya no le corresponde. */
export function useFiltroUbicacion() {
  const [empresa, setEmpresaRaw] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const empresas = useEmpresas();
  const ubicaciones = useUbicaciones();

  const lista = ubicaciones.data ?? [];
  const deLaEmpresa = empresa ? lista.filter((u) => u.empresa?.id === empresa) : lista;

  const setEmpresa = (id: string) => {
    setEmpresaRaw(id);
    // Si la ubicación elegida no es de la nueva empresa, se limpia
    if (ubicacion && id && lista.find((u) => u.id === ubicacion)?.empresa?.id !== id) setUbicacion('');
  };

  return {
    empresa,
    ubicacion,
    setEmpresa,
    setUbicacion,
    empresas: empresas.data ?? [],
    ubicaciones: deLaEmpresa,
    /** Parámetros listos para la API */
    params: { empresa_id: empresa, ubicacion_id: ubicacion },
    /** Solo tiene sentido mostrar el selector de empresa si hay más de una */
    variasEmpresas: (empresas.data?.length ?? 0) > 1,
    reset: () => {
      setEmpresaRaw('');
      setUbicacion('');
    },
  };
}

export type FiltroUbicacion = ReturnType<typeof useFiltroUbicacion>;

/** Chips "Empresa" y "Ubicación" (la empresa solo aparece si hay varias). */
export function FiltroUbicacionChips({ f, onChange }: { f: FiltroUbicacion; onChange?: () => void }) {
  return (
    <>
      {f.variasEmpresas && (
        <FilterChip label="Empresa" active={!!f.empresa}>
          <select
            className={sel}
            value={f.empresa}
            onChange={(e) => {
              f.setEmpresa(e.target.value);
              onChange?.();
            }}
          >
            <option value="">todas</option>
            {f.empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </FilterChip>
      )}
      <FilterChip label="Ubicación" active={!!f.ubicacion}>
        <select
          className={sel}
          value={f.ubicacion}
          onChange={(e) => {
            f.setUbicacion(e.target.value);
            onChange?.();
          }}
        >
          <option value="">todas</option>
          {f.ubicaciones.map((u) => (
            <option key={u.id} value={u.id}>
              {f.variasEmpresas && !f.empresa && u.empresa ? `${u.empresa.nombre} · ${u.nombre}` : u.nombre}
            </option>
          ))}
        </select>
      </FilterChip>
    </>
  );
}
