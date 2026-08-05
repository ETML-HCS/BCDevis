FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY central-server ./central-server

USER node
EXPOSE 8787
CMD ["node", "central-server/server.cjs"]
