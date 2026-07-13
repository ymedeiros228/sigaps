import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MunicipalitiesModule } from './modules/municipalities/municipalities.module';
import { MicroareasModule } from './modules/microareas/microareas.module';
import { StreetsModule } from './modules/streets/streets.module';
import { OsmModule } from './modules/osm/osm.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { UbsModule } from './modules/ubs/ubs.module';
import { AcsModule } from './modules/acs/acs.module';
import { NeighborhoodsModule } from './modules/neighborhoods/neighborhoods.module';
import { SearchModule } from './modules/search/search.module';
import { GeoModule } from './modules/geo/geo.module';
import { PaintZonesModule } from './modules/paint-zones/paint-zones.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { CadastrosModule } from './modules/cadastros/cadastros.module';
import { PlacesModule } from './modules/places/places.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { MunicipalityScopeGuard } from './common/guards/municipality-scope.guard';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: Number(process.env.THROTTLE_LIMIT_DEFAULT ?? (process.env.CI ? 10_000 : 500)),
      },
      { name: 'auth', ttl: 60_000, limit: process.env.CI ? 500 : 15 },
    ]),
    PrismaModule,
    AuthModule,
    MunicipalitiesModule,
    MicroareasModule,
    StreetsModule,
    OsmModule,
    DashboardModule,
    AuditModule,
    UbsModule,
    AcsModule,
    NeighborhoodsModule,
    SearchModule,
    GeoModule,
    PaintZonesModule,
    HealthModule,
    AdminModule,
    IntegrationsModule,
    CadastrosModule,
    PlacesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MunicipalityScopeGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
