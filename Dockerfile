FROM docker.io/library/node:24.11.1-slim@sha256:73bbe830ced072b4a9e4029f2513f7e85f0ea57dd1c5766fd0260d5122e85178 AS build
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

FROM gcr.io/distroless/nodejs24-debian12:nonroot@sha256:3a44cd24b43527a1c3d491d3ff166fc0745f80e6be5adbc32f1879a95ec72873
WORKDIR /opt/loinc-conversion
EXPOSE 8080/tcp
ENV NODE_ENV=production \
    NO_UPDATE_NOTIFIER=true
USER 65532:65532

COPY --from=build /opt/loinc-conversion .
CMD [ "src/server.js" ]
