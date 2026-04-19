function createLogger(logger = console) {
  return {
    info(event, details) {
      (logger.info || console.info).call(logger, event, details);
    },
    warn(event, details) {
      (logger.warn || console.warn).call(logger, event, details);
    },
    error(event, details) {
      (logger.error || console.error).call(logger, event, details);
    },
  };
}

module.exports = {
  createLogger,
};
