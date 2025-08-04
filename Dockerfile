FROM docker.io/library/node:22.18.0-slim@sha256:3b68ed4d422ba79da237ffa83523ace72b76d2572cc45dedd88d1645bbe5d4d3 AS build
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

FROM gcr.io/distroless/nodejs22-debian12:nonroot@sha256:4358a2d9951da0174a3d1bd6a1cf69e5b9927b5fc0024563904492937ade907f
WORKDIR /opt/loinc-conversion
EXPOSE 8080/tcp
ENV NODE_ENV=production \
    NO_UPDATE_NOTIFIER=true
USER 65532:65532

COPY --from=build /opt/loinc-conversion .
CMD [ "src/server.js" ]
