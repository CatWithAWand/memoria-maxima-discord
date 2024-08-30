import { Events } from 'discord.js';

import logger from '@/lib/logger';
import type { Event } from '@/types';

const ready: Event<Events.ClientReady> = {
  execute: async (client) => {
    logger.info(`Ready! Logged in as ${client.user.tag}`);
  },
  name: Events.ClientReady,
  once: true,
};

export default ready;
