import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:5173'),
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

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`SIGAPS API rodando em http://localhost:${port}`);
  console.log(`Swagger em http://localhost:${port}/docs`);
}

bootstrap();
