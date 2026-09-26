import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Company } from './entities/company.entity';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Company])],
  controllers: [UsersController, CompanyController],
  providers: [UsersService, CompanyService],
  exports: [UsersService, CompanyService],
})
export class UsersModule {}
