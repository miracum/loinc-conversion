FROM docker.io/library/node:22.18.0-slim@sha256:88f44fbb06cc98e1451e4e015c122f84030ec55c603f753ed97b889db0bb8d4d AS build
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

FROM gcr.io/distroless/nodejs22-debian12:nonroot@sha256:8929dbab735ee399ff886ba7d81419dbe7df002993a7d69715e1c16b7d41c531
WORKDIR /opt/loinc-conversion
EXPOSE 8080/tcp
ENV NODE_ENV=production \
    NO_UPDATE_NOTIFIER=true
USER 65532:65532

COPY --from=build /opt/loinc-conversion .
CMD [ "src/server.js" ]
