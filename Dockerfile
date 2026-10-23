FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=4000 DB_PATH=/app/data/ar-calhas.sqlite ACCESS_MODE=local BIND_HOST=127.0.0.1
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir data backups && chown -R node:node /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
USER node
EXPOSE 4000
CMD ["node", "server/index.js"]
