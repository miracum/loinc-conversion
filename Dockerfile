# syntax=docker/dockerfile:1.4
FROM docker.io/library/node:21.1.0-alpine@sha256:df76a9449df49785f89d517764012e3396b063ba3e746e8d88f36e9f332b1864
WORKDIR /opt/loinc-conversion
EXPOSE 8080/tcp
HEALTHCHECK CMD wget --quiet --spider http://localhost:8080/live || exit 1
ENV NODE_ENV=production \
    NO_UPDATE_NOTIFIER=true \
    NPM_CONFIG_CACHE=/opt/loinc-conversion/.npm

# this is only needed because the e2e-test runs using NPM
# to avoid the misleading error:
# `Your cache folder contains root-owned files, due to a bug in
#  previous versions of npm which has since been addressed.`
RUN chown -R 65534:65534 .
USER 65534:65534

COPY data data

COPY package*.json ./
RUN <<EOF
npm clean-install --omit=optional
npm cache clean --force
EOF

COPY src src
# while generally considered a bad practice, in this case the small size
# of the test data makes it acceptable to copy them to the production image.
# at least for now...
COPY tests/e2e tests/e2e

CMD [ "src/server.js" ]

ARG VERSION=0.0.0
ARG GIT_REF=""
ARG BUILD_TIME=""
LABEL org.opencontainers.image.created=${BUILD_TIME} \
    org.opencontainers.image.authors="miracum.org" \
    org.opencontainers.image.source="https://gitlab.miracum.org/miracum/etl/loinc-conversion" \
    org.opencontainers.image.version=${VERSION} \
    org.opencontainers.image.revision=${GIT_REF} \
    org.opencontainers.image.vendor="miracum.org" \
    org.opencontainers.image.title="loinc-conversion" \
    org.opencontainers.image.description="Convert LOINC codes and UCUM units to a standard representation."
