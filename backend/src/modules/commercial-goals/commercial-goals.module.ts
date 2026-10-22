import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { Role } from '../auth/models/role.model';
import { User } from '../auth/models/user.model';
import { DemandGenerationModule } from '../demand-generation/demand-generation.module';
import { CommercialGoalsController } from './controllers/commercial-goals.controller';
import { CommercialGoal } from './models/commercial-goal.model';
import { CommercialGoalsService } from './services/commercial-goals.service';

@Module({
  imports: [
    SequelizeModule.forFeature([CommercialGoal, User, Role]),
    AuthModule,
    DemandGenerationModule,
  ],
  controllers: [CommercialGoalsController],
  providers: [CommercialGoalsService],
  exports: [CommercialGoalsService],
})
export class CommercialGoalsModule {}
