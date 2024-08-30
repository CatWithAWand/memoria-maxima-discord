import logger from '@/lib/logger';

export const handleUncaughtException = async (error: Error): Promise<void> => {
  logger.error({
    error,
    event: 'UncaughtException',
    msg: 'An uncaught exception occurred',
  });
};

export const handleUnhandledRejection = async (
  reason: any,
  promise: Promise<any>,
): Promise<void> => {
  logger.error({
    event: 'UnhandledRejection',
    msg: 'An unhandled rejection occurred',
    promise,
    reason,
  });
};
