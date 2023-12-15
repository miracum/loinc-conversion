# syntax=docker/dockerfile:1.4
FROM docker.io/library/node:20.9.0-slim@sha256:da981564279232f7962576d79d01832cc12f8270e8ddd05bb3077af8061a50ca AS build
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

FROM gcr.io/distroless/nodejs20-debian12:nonroot@sha256:015be521134f97b5f2b4c1543615eb4be907fadc8c6a52e60fd0c18f7cda0337
WORKDIR /opt/loinc-conversion
EXPOSE 8080/tcp
ENV NODE_ENV=production \
    NO_UPDATE_NOTIFIER=true
USER 65532:65532

COPY --from=build /opt/loinc-conversion .
CMD [ "src/server.js" ]
