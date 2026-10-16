import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';

import { toNestUrl } from './serverless-url';

type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

let handlerPromise: Promise<ExpressHandler> | null = null;

/** Sobe o Nest uma vez por instância e reaproveita entre requisições. */
function getHandler() {
  handlerPromise ??= (async () => {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    setupApp(app);
    await app.init();
    return app.getHttpAdapter().getInstance() as ExpressHandler;
  })().catch((error) => {
    handlerPromise = null;
    throw error;
  });
  return handlerPromise;
}

/** Função do Vercel: ajusta a URL (sem /api e sem o ?path= do rewrite) e entrega ao Nest. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  req.url = toNestUrl(req.url);
  const app = await getHandler();
  app(req, res);
}
