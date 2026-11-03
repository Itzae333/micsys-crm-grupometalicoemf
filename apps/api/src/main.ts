import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  for (const k of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!process.env[k]) throw new Error(`Falta la variable de entorno ${k}`);
  }
  if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
  }

  const app = await NestFactory.create(AppModule);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // CORS: solo el frontend configurado (varios separados por coma)
  const origins = (process.env.FRONTEND_URL ?? 'http://localhost:3100').split(',').map((s) => s.trim());
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Health check sin prefijo, para Railway
  app.getHttpAdapter().get('/health', (_req: unknown, res: { json: (v: unknown) => void }) => {
    res.json({ status: 'ok' });
  });
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3101;
  await app.listen(port);
  console.log(`Cauce API en http://localhost:${port}/api/v1`);
}

bootstrap();
