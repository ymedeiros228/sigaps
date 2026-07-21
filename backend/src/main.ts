import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { join } from 'path';
import { existsSync } from 'fs';
import type { ServerResponse } from 'http';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

function serveUploadSubdir(app: NestExpressApplication, subdir: string) {
  const dir = join(process.cwd(), 'uploads', subdir);
  if (existsSync(dir)) {
    app.useStaticAssets(dir, { prefix: `/uploads/${subdir}/` });
  }
}

const LEGACY_ZIP_FILENAME = 'sigaps-legado-passagem-franca.zip';

function serveLegacyZip(publicDir: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const zipPaths = new Set([
      `/${LEGACY_ZIP_FILENAME}`,
      `/entrega/${LEGACY_ZIP_FILENAME}`,
      `/downloads/${LEGACY_ZIP_FILENAME}`,
    ]);
    if (!zipPaths.has(req.path)) return next();
    const file = join(publicDir, 'downloads', LEGACY_ZIP_FILENAME);
    if (!existsSync(file)) return next();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${LEGACY_ZIP_FILENAME}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(file);
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(compression());
  // Apenas subpastas públicas (fotos ACS, logos). Backups NÃO são servidos estaticamente.
  serveUploadSubdir(app, 'acs');
  serveUploadSubdir(app, 'logos');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const frontendUrls = config
    .get<string>('FRONTEND_URL', 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  app.enableCors({
    origin: frontendUrls.length === 1 ? frontendUrls[0] : frontendUrls,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SIGAPS API')
    .setDescription(
      'Sistema Inteligente de Gestão das Microáreas da Atenção Primária à Saúde',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (config.get<string>('NODE_ENV') !== 'production') {
    SwaggerModule.setup('docs', app, document);
  }

  const publicDir = join(process.cwd(), 'public');
  if (existsSync(publicDir)) {
    app.use(serveLegacyZip(publicDir));

    const apiPrefixes = [
      '/health',
      '/auth',
      '/municipalities',
      '/streets',
      '/microareas',
      '/ubs',
      '/acs',
      '/neighborhoods',
      '/places',
      '/search',
      '/dashboard',
      '/osm',
      '/geo',
      '/audit',
      '/admin',
      '/paint-zones',
      '/integrations',
      '/cadastros',
      '/entrega',
      '/docs',
      '/uploads',
    ];
    const isApiPath = (path: string) =>
      apiPrefixes.some((p) => {
        // Rotas do React; a API usa subcaminhos (ex.: /dashboard/:id, /cadastros/municipality/:id)
        if (p === '/dashboard' || p === '/cadastros' || p === '/integrations') {
          return path.startsWith(`${p}/`);
        }
        return path === p || path.startsWith(`${p}/`);
      });

    app.useStaticAssets(publicDir, {
      index: false,
      fallthrough: true,
      maxAge: '365d',
      setHeaders: (res: ServerResponse, filePath: string) => {
        const base = filePath.replace(/\\/g, '/');
        if (base.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return;
        }
        // SW/workbox desatualizado quebra o mapa após deploy (chunks 404).
        if (
          base.endsWith('/sw.js') ||
          base.endsWith('sw.js') ||
          base.includes('workbox-')
        ) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (isApiPath(req.path)) return next();
      if (req.path.includes('.')) return next();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(join(publicDir, 'index.html'), (err) => {
        if (err) next();
      });
    });
    console.log(`Frontend SIGAPS em / (pasta ${publicDir})`);
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`SIGAPS API rodando em http://localhost:${port}`);
  if (config.get<string>('NODE_ENV') !== 'production') {
    console.log(`Swagger em http://localhost:${port}/docs`);
  }
}

void bootstrap();
