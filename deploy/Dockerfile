FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY server ./server
COPY shared ./shared
RUN npm ci
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/build/main.cjs ./build/main.cjs
ENV HOST=0.0.0.0 PORT=8787
USER node
EXPOSE 8787
CMD ["node", "build/main.cjs"]
