// México no usa horario de verano desde 2022: America/Mexico_City es UTC-6 fijo.
export const TZ = 'America/Mexico_City';

/** 'YYYY-MM-DD' -> mediodía hora de México (evita corrimientos de día). ISO completo se respeta. */
export function parseFecha(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00-06:00`);
  return new Date(s);
}

export function inicioDiaMx(d = new Date()): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  return new Date(`${ymd}T00:00:00-06:00`);
}

export function inicioMesMx(d = new Date()): Date {
  const ym = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d).slice(0, 7);
  return new Date(`${ym}-01T00:00:00-06:00`);
}

export function sumarDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
