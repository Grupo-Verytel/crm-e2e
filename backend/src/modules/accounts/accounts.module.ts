import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AccountsController } from './controllers/accounts.controller';
import { PeopleController } from './controllers/people.controller';
import { Account } from './models/account.model';
import { Person } from './models/person.model';
import { AccountsService } from './services/accounts.service';

@Module({
  imports: [SequelizeModule.forFeature([Account, Person])],
  controllers: [PeopleController, AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
