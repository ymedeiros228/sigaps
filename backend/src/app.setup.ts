import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { join } from 'path';
import { existsSync } from 'fs';

function serveUploadSubdir(app: NestExpressApplication, subdir: string) {
  const dir = join(process.cwd(), 'uploads', subdir);
  if (existsSync(dir)) {
    app.useStaticAssets(dir, { prefix: `/uploads/${subdir}/` });
  }
}

/** Configuração comum ao servidor (main.ts) e à função serverless do Vercel. */
export function setupApp(app: NestExpressApplication) {
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

  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }
}
