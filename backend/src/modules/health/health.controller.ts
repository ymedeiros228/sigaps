import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/roles.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Verifica se a API está online' })
  check() {
    const commit =
      process.env.RENDER_GIT_COMMIT?.trim() ||
      process.env.GIT_COMMIT?.trim() ||
      null;
    return { ok: true, ts: Date.now(), commit };
  }
}
