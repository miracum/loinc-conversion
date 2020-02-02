FROM node:13.7-alpine
WORKDIR /opt/loinc-conversion

COPY package*.json ./
ENV NODE_ENV=production
RUN npm ci --no-optional --only=prod
COPY src src
COPY data data

EXPOSE 8080
HEALTHCHECK CMD wget --quiet --spider http://localhost:8080/health || exit 1
ENTRYPOINT [ "npm", "run", "start" ]
