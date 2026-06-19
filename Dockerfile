FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY migrations ./migrations
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

# GOTCHA (baked-in): CMD must run the real server entry that calls listen()
# and runs migrations — NOT a stub module. src/server.js does both.
CMD ["node", "src/server.js"]
