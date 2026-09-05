FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY server ./server
COPY shared ./shared
RUN npx esbuild server/src/cli.ts --bundle --platform=node --format=cjs --outfile=server.cjs
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/server.cjs ./server.cjs
ENV HOST=0.0.0.0 PORT=8787
USER node
EXPOSE 8787
CMD ["node","server.cjs"]
