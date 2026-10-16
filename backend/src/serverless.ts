import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';

type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

/** Prefixo pelo qual o Vercel encaminha a API (vercel.json → /api/*). */
const API_PREFIX = '/api';

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

/** Função do Vercel: tira o /api da frente e entrega para o Express do Nest. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.url === API_PREFIX || req.url?.startsWith(`${API_PREFIX}/`)) {
    req.url = req.url.slice(API_PREFIX.length) || '/';
  }
  const app = await getHandler();
  app(req, res);
}
