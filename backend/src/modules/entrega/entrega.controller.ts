import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';
import { Public } from '../../common/decorators/roles.decorator';

const ZIP_FILENAME = 'sigaps-legado-passagem-franca.zip';

@ApiTags('Entrega')
@SkipThrottle()
@Controller('entrega')
export class EntregaController {
  @Get(ZIP_FILENAME)
  @Public()
  @ApiOperation({
    summary: 'Download do código-fonte legado (ZIP) para entrega ao Jonas',
  })
  downloadLegado(@Res() res: Response) {
    const file = join(process.cwd(), 'public', 'downloads', ZIP_FILENAME);
    if (!existsSync(file)) {
      throw new NotFoundException(
        'Pacote ZIP não encontrado no servidor. Rode scripts/package-entrega-jonas.sh e faça deploy.',
      );
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ZIP_FILENAME}"`,
    );
    res.sendFile(file);
  }
}
