const winston = require("winston");

const { combine, timestamp, json } = winston.format;

const logger = winston.createLogger({
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      level: "debug"
    })
  ],
  exitOnError: false
});

logger.stream = {
  write: message => {
    logger.info(message);
  }
};

module.exports = logger;
