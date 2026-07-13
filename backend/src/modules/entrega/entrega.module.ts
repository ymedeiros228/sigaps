import { Module } from '@nestjs/common';
import { EntregaController } from './entrega.controller';

@Module({
  controllers: [EntregaController],
})
export class EntregaModule {}
