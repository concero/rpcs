FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV INPUT_DIR=/data/input
ENV OUTPUT_DIR=/data/output

VOLUME ["/data/input", "/data/output"]

CMD ["node", "dist/index.js"]
