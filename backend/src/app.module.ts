import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
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
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
