# syntax=docker/dockerfile:1.7@sha256:dbbd5e059e8a07ff7ea6233b213b36aa516b4c53c645f1817a4dd18b83cbea56
FROM docker.io/library/node:22.8.0-slim@sha256:377674fd5bb6fc2a5a1ec4e0462c4bfd4cee1c51f705bbf4bda0ec2c9a73af72 AS build
WORKDIR /opt/loinc-conversion
ENV NODE_ENV=production \
    NO_UPDATE_NOTIFIER=true

COPY data data

COPY package*.json ./
RUN <<EOF
npm clean-install --omit=dev
npm cache clean --force
EOF

COPY src src

FROM build AS test
ENV NODE_ENV=development
RUN npm clean-install
COPY tests/e2e tests/e2e

FROM gcr.io/distroless/nodejs20-debian12:nonroot@sha256:c4c595a36ad2ced3cd952fad295a6afcb4469e91927159cfb95790031fe65d95
WORKDIR /opt/loinc-conversion
EXPOSE 8080/tcp
ENV NODE_ENV=production \
    NO_UPDATE_NOTIFIER=true
USER 65532:65532

COPY --from=build /opt/loinc-conversion .
CMD [ "src/server.js" ]
