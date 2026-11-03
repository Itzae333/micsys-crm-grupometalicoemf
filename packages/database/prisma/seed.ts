import 'dotenv/config';
import { PrismaClient, RolUsuario } from '../src/generated/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const MONEDAS = [
  { codigo: 'MXN', nombre: 'Peso mexicano', simbolo: '$' },
  { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: 'US$' },
  { codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@crm.local';
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error('Define SEED_ADMIN_PASSWORD para crear el usuario admin');

  const org = await prisma.organizacion.upsert({
    where: { id: 'org-principal' },
    update: {},
    create: { id: 'org-principal', nombre: process.env.SEED_ORG_NAME ?? 'EMFIMIFAR' },
  });

  for (const m of MONEDAS) {
    await prisma.moneda.upsert({
      where: { organizacion_id_codigo: { organizacion_id: org.id, codigo: m.codigo } },
      update: {},
      create: { organizacion_id: org.id, ...m },
    });
  }

  await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      organizacion_id: org.id,
      nombre: process.env.SEED_ADMIN_NAME ?? 'Administradora',
      email,
      password_hash: await argon2.hash(password),
      rol: RolUsuario.SUPER_ADMIN,
    },
  });

  console.log(`Seed OK — super usuario: ${email}`);
  console.log('Siguiente paso: entra y, en Configuración, trae las ubicaciones del ERP; luego da de alta usuarios en Usuarios.');
}

main().finally(() => prisma.$disconnect());
