FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json server.mjs ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /data /app/backups && chown -R node:node /data /app/backups
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
