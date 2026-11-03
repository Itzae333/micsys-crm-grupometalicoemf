import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join, resolve, sep } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, Roles } from '../common/auth';
import type { AuthUser } from '../common/auth';

const PERMITIDOS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
const MAX_BYTES = 8 * 1024 * 1024;

const raiz = () => resolve(process.env.UPLOADS_DIR ?? './uploads');

@Controller()
export class ComprobantesController {
  constructor(private prisma: PrismaService) {}

  @Post('movimientos/:id/comprobantes')
  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES } }))
  async subir(@CurrentUser() u: AuthUser, @Param('id') id: string, @UploadedFile() f?: Express.Multer.File) {
    if (!f) throw new BadRequestException('Adjunta un archivo en el campo "archivo".');
    const ext = PERMITIDOS[f.mimetype];
    if (!ext) throw new BadRequestException('Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF.');
    const mov = await this.prisma.movimiento.findFirst({ where: { id, organizacion_id: u.organizacion_id } });
    if (!mov) throw new NotFoundException('Movimiento no encontrado');

    // El nombre en disco lo genera el servidor: nada del cliente entra a la ruta.
    const key = join(u.organizacion_id, `${id}-${randomBytes(8).toString('hex')}${ext}`);
    const abs = join(raiz(), key);
    await fs.mkdir(join(raiz(), u.organizacion_id), { recursive: true });
    await fs.writeFile(abs, f.buffer);

    return this.prisma.comprobante.create({
      data: {
        movimiento_id: id,
        nombre: (f.originalname || `comprobante${extname(f.originalname || '') || ext}`).slice(0, 120),
        mime: f.mimetype,
        tamano: f.size,
        storage_key: key,
        subido_por_id: u.id,
      },
      select: { id: true, nombre: true, mime: true, tamano: true },
    });
  }

  @Get('comprobantes/:id')
  async ver(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const c = await this.prisma.comprobante.findFirst({
      where: { id, movimiento: { organizacion_id: u.organizacion_id } },
    });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    const abs = resolve(raiz(), c.storage_key);
    if (!abs.startsWith(raiz() + sep)) throw new NotFoundException();
    try {
      const data = await fs.readFile(abs);
      res.setHeader('Content-Type', c.mime);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(c.nombre)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(data);
    } catch {
      throw new NotFoundException('El archivo ya no está disponible en el servidor.');
    }
  }

  @Delete('comprobantes/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async quitar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const c = await this.prisma.comprobante.findFirst({
      where: { id, movimiento: { organizacion_id: u.organizacion_id } },
    });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    await this.prisma.comprobante.delete({ where: { id } });
    await fs.rm(resolve(raiz(), c.storage_key), { force: true });
    return { ok: true };
  }
}
