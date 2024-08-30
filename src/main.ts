import { Client } from 'discord.js';

import { config } from '@/lib/config';
import { env } from '@/lib/env';
import logger from '@/lib/logger';
import * as store from '@/lib/store';
import { deployCommands, loadCommands } from '@/utils/commands';
import {
  handleUncaughtException,
  handleUnhandledRejection,
} from '@/utils/errorHandlers';
import { loadEvents } from '@/utils/events';

logger.info(`Environment: ${env.NODE_ENV}`);

process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

const client = new Client({ intents: config.INTENTS });

const initialize = async (): Promise<void> => {
  await store.connect();
  await loadCommands();
  await deployCommands(env.DISCORD_TOKEN, env.DISCORD_APPLICATION_ID);
  await loadEvents(client);
  await client.login(env.DISCORD_TOKEN);
};

initialize();
