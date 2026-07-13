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
    } catch {
      return { ok: false, ts: Date.now() };
    }
  }

  @Get('postgis')
  @Public()
  @ApiOperation({ summary: 'Verifica PostGIS e coluna geom das ruas' })
  async postgis() {
    try {
      const ext = await this.prisma.$queryRaw<Array<{ ext: string | null }>>`
        SELECT extname AS ext FROM pg_extension WHERE extname = 'postgis' LIMIT 1
      `;
      const geom = await this.prisma.$queryRaw<Array<{ has_geom: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'streets' AND column_name = 'geom'
        ) AS has_geom
      `;
      const indexed = await this.prisma.$queryRaw<Array<{ has_idx: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes WHERE tablename = 'streets' AND indexname = 'streets_geom_gist_idx'
        ) AS has_idx
      `;
      const ok = !!ext[0]?.ext && geom[0]?.has_geom === true;
      return {
        ok,
        ts: Date.now(),
        postgis: !!ext[0]?.ext,
        streetsGeom: geom[0]?.has_geom === true,
        streetsGeomIndex: indexed[0]?.has_idx === true,
      };
    } catch {
      return { ok: false, ts: Date.now() };
    }
  }
}
