import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Client, type ClientEvents } from 'discord.js';

import type { Event } from '@/types';

const loadEvents = async (client: Client<boolean>): Promise<void> => {
  const filename = fileURLToPath(import.meta.url);
  const commandsPath = path.join(path.dirname(filename), '../events');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const event = (await import(filePath)).default as Event<keyof ClientEvents>;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
};

export { loadEvents };
