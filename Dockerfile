FROM docker.io/library/node:24.9.0-slim@sha256:0cce74a5708f603925e2bf01929da8d71e92b5e2493fcfb662d5a8ffed2d8ef1 AS build
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

FROM gcr.io/distroless/nodejs24-debian12:nonroot@sha256:a58790048b54a9a6680b0ca6eb5b497efcb6225905e30f8e77f2edf76ffaf311
WORKDIR /opt/loinc-conversion
EXPOSE 8080/tcp
ENV NODE_ENV=production \
    NO_UPDATE_NOTIFIER=true
USER 65532:65532

COPY --from=build /opt/loinc-conversion .
CMD [ "src/server.js" ]
