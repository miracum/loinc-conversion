FROM node:13-slim

COPY ./server.js /opt/loinc-conversion/server.js
COPY ./package.json /opt/loinc-conversion/package.json
COPY ./conversion.csv /opt/loinc-conversion/conversion.csv
COPY ./Loinc.csv /opt/loinc-conversion/Loinc.csv
COPY ./start.sh /opt/loinc-conversion/start.sh

WORKDIR /opt/loinc-conversion
RUN npm install

ENTRYPOINT ["node", "server.js"]