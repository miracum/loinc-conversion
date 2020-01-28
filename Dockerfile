FROM node:13-slim

WORKDIR /opt/loinc-conversion

COPY server.js .
COPY package.json .
COPY conversion.csv .
COPY Loinc.csv .

RUN npm install

ENTRYPOINT ["node", "server.js"]
