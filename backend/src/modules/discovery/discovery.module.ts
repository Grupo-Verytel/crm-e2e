import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Ouv } from './models/ouv.model';
import { OuvsService } from './services/ouvs.service';

@Module({
  imports: [SequelizeModule.forFeature([Ouv])],
  providers: [OuvsService],
  exports: [OuvsService],
})
export class DiscoveryModule {}
