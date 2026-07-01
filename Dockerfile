# SIGAPS — API + frontend (mesma URL no Render)
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Mesma origem: API e site no sigaps-api.onrender.com
ENV VITE_API_URL=
ENV VITE_DEV_AUTO_LOGIN=false
RUN npm run build

FROM node:20-alpine AS backend-builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/node_modules/@prisma ./node_modules/@prisma
COPY backend/prisma ./prisma
COPY backend/assets ./assets
COPY --from=frontend-builder /frontend/dist ./public
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
