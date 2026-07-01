import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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

  @Get('db')
  @Public()
  @ApiOperation({ summary: 'Verifica conexão com o banco de dados' })
  async db() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, ts: Date.now() };
    } catch (error) {
      return { ok: false, ts: Date.now(), error: (error as Error).message };
    }
  }
}
