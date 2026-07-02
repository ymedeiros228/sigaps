import { Module } from '@nestjs/common';
import { CadastrosController } from './cadastros.controller';
import { CadastrosService } from './cadastros.service';
import { MunicipalitiesModule } from '../municipalities/municipalities.module';
import { MicroareasModule } from '../microareas/microareas.module';
import { AcsModule } from '../acs/acs.module';
import { UbsModule } from '../ubs/ubs.module';
import { NeighborhoodsModule } from '../neighborhoods/neighborhoods.module';

@Module({
  imports: [
    MunicipalitiesModule,
    MicroareasModule,
    AcsModule,
    UbsModule,
    NeighborhoodsModule,
  ],
  controllers: [CadastrosController],
  providers: [CadastrosService],
})
export class CadastrosModule {}
