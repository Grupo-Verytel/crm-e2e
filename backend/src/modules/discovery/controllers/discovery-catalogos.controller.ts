import { Controller, Get } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { MotivoCatalogoResponseDto } from '../dtos/catalogo.dto';
import { CatalogosOuvService } from '../services/catalogos-ouv.service';

/**
 * Read-only catalog endpoints for the OUV close flow.
 * Gated by Opportunity read so EjecutivoComercial can load motivos_perdida
 * without needing the admin CRUD subject.
 */
@Controller('discovery')
export class DiscoveryCatalogosController {
  constructor(private readonly catalogos: CatalogosOuvService) {}

  @Get('motivos-perdida')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  listMotivosPerdida(): Promise<MotivoCatalogoResponseDto[]> {
    return this.catalogos.listMotivosPerdida();
  }

  @Get('motivos-descarte')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  listMotivosDescarte(): Promise<MotivoCatalogoResponseDto[]> {
    return this.catalogos.listMotivosDescarte();
  }
}
