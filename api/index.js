// Função serverless do Vercel: toda a API do SIGAPS (NestJS) responde em /api/*.
// O build (npm run vercel-build) gera backend/dist antes desta função ser empacotada.
module.exports = require('../backend/dist/src/serverless.js').default;
