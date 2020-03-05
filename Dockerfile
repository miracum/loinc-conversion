FROM node:13.8-alpine
WORKDIR /opt/loinc-conversion

COPY package*.json ./
RUN npm ci
COPY src src
# while generelly considered a bad practice, in this case the small size
# of the test data makes it acceptable to copy them to the production image.
# at least for now...
COPY tests/e2e tests/e2e
COPY data data

EXPOSE 8080
HEALTHCHECK CMD wget --quiet --spider http://localhost:8080/health || exit 1
ENV NODE_ENV=production
ENTRYPOINT [ "npm" ]
CMD [ "run", "start" ]
