import pino from 'pino';

const logger = pino({
  errorKey: 'error',
});

export default logger;
