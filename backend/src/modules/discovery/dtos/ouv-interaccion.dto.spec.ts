import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  CrearOuvInteraccionDto,
  ResponderOuvInteraccionDto,
} from './ouv-interaccion.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe('OUV interaction DTOs', () => {
  it('accepts recordatorio on the interaction create body', async () => {
    const dto = await pipe.transform(
      {
        titulo: 'Seguimiento',
        recordatorio: { event_at: '2026-12-01T15:00:00.000Z' },
      },
      { type: 'body', metatype: CrearOuvInteraccionDto },
    );
    expect(dto.recordatorio.event_at).toBe('2026-12-01T15:00:00.000Z');
  });

  it('rejects recordatorio on a thread reply', async () => {
    await expect(
      pipe.transform(
        {
          titulo: 'Respuesta',
          recordatorio: { event_at: '2026-12-01T15:00:00.000Z' },
        },
        { type: 'body', metatype: ResponderOuvInteraccionDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
