import { Controller, Get } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { SegmentResponseDto } from '../dtos/segment-response.dto';
import { DemandGenerationService } from '../services/demand-generation.service';

@Controller('segments')
export class SegmentsController {
  constructor(
    private readonly demandGenerationService: DemandGenerationService,
  ) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Lead' })
  listSegments(): Promise<SegmentResponseDto[]> {
    return this.demandGenerationService.listSegments();
  }
}
