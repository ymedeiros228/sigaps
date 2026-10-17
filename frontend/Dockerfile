FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Pacote xlsx oficial da SheetJS (vem como arquivo, não do npm)
COPY vendor ./vendor
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
