FROM node:14.5-alpine
WORKDIR /opt/loinc-conversion

COPY package*.json ./
RUN npm ci --no-optional

COPY data data
COPY src src
# while generally considered a bad practice, in this case the small size
# of the test data makes it acceptable to copy them to the production image.
# at least for now...
COPY tests/e2e tests/e2e

USER node
EXPOSE 8080
HEALTHCHECK CMD wget --quiet --spider http://localhost:8080/health || exit 1
ENV NODE_ENV=production
ENTRYPOINT [ "npm" ]
CMD ["run", "start"]

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
