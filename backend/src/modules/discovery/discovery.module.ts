import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AccountsModule } from '../accounts/accounts.module';
import { DemandGenerationModule } from '../demand-generation/demand-generation.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { MotivosDescarteController } from './controllers/motivos-descarte.controller';
import { MotivosPerdidaController } from './controllers/motivos-perdida.controller';
import { OuvContactosController } from './controllers/ouv-contactos.controller';
import { OuvsController } from './controllers/ouvs.controller';
import { ZonaChecklistTemplatesController } from './controllers/zona-checklist-templates.controller';
import { MotivoDescarte } from './models/motivo-descarte.model';
import { MotivoPerdida } from './models/motivo-perdida.model';
import { OuvChecklistItem } from './models/ouv-checklist-item.model';
import { OuvContacto } from './models/ouv-contacto.model';
import { OuvInfluencia } from './models/ouv-influencia.model';
import { Ouv } from './models/ouv.model';
import { ZonaChecklistTemplate } from './models/zona-checklist-template.model';
import { CatalogosOuvService } from './services/catalogos-ouv.service';
import { CriteriosZonaEvaluator } from './services/criterios-zona.evaluator';
import { OuvChecklistService } from './services/ouv-checklist.service';
import { OuvContactosService } from './services/ouv-contactos.service';
import { OuvInfluenciasService } from './services/ouv-influencias.service';
import { OuvsService } from './services/ouvs.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Ouv,
      OuvContacto,
      OuvInfluencia,
      OuvChecklistItem,
      MotivoPerdida,
      MotivoDescarte,
      ZonaChecklistTemplate,
    ]),
    AccountsModule,
    DemandGenerationModule,
    WorkflowEngineModule,
  ],
  controllers: [
    OuvsController,
    OuvContactosController,
    MotivosPerdidaController,
    MotivosDescarteController,
    ZonaChecklistTemplatesController,
  ],
  providers: [
    OuvsService,
    OuvContactosService,
    OuvInfluenciasService,
    OuvChecklistService,
    CriteriosZonaEvaluator,
    CatalogosOuvService,
  ],
  exports: [
    OuvsService,
    OuvContactosService,
    OuvInfluenciasService,
    OuvChecklistService,
    CriteriosZonaEvaluator,
    CatalogosOuvService,
    SequelizeModule,
  ],
})
export class DiscoveryModule {}
