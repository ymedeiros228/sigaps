import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(compression());
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

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
  SwaggerModule.setup('docs', app, document);

  const publicDir = join(process.cwd(), 'public');
  if (existsSync(publicDir)) {
    app.useStaticAssets(publicDir, { index: false, fallthrough: true });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (
        req.path.startsWith('/docs') ||
        req.path.startsWith('/uploads') ||
        req.path.includes('.')
      ) {
        return next();
      }
      res.sendFile(join(publicDir, 'index.html'), (err) => {
        if (err) next();
      });
    });
    console.log(`Frontend SIGAPS em / (pasta ${publicDir})`);
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`SIGAPS API rodando em http://localhost:${port}`);
  console.log(`Swagger em http://localhost:${port}/docs`);
}

bootstrap();
