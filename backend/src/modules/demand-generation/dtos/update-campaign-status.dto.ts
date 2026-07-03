import { IsEnum } from 'class-validator';
import { CampaignEstado } from '../models/enums/campaign.enums';

export class UpdateCampaignStatusDto {
  @IsEnum(CampaignEstado)
  estado: CampaignEstado;
}
