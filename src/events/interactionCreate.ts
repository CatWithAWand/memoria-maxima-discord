import { type CacheType, Events, type Interaction } from 'discord.js';

import { env } from '@/lib/env';
import logger from '@/lib/logger';
import { getCommand } from '@/lib/store';
import type { Event } from '@/types';

const isProduction = env.NODE_ENV === 'production';

const hasPermission = (interaction: Interaction<CacheType>) => {
  if (isProduction) return true;

  console.log(env.DEV_ALLOWLIST);

  return env.DEV_ALLOWLIST.includes(interaction.user.id);
};

const interactionCreate: Event<Events.InteractionCreate> = {
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!hasPermission(interaction)) {
      interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    const command = getCommand(interaction.commandName);

    if (!command) {
      logger.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
      logger.info({
        event: 'InteractionCreate',
        msg: `Entity ${interaction.user.globalName} (${interaction.user.id}) executed command "${command.data.name}" from ${interaction.guild?.id}`,
      });
    } catch (error) {
      logger.error({
        error,
        event: 'InteractionCreate',
        msg: `Failed to execute command "${command.data.name}"${interaction.options.data ? ` with options "${JSON.stringify(interaction.options.data)}"` : ''} for entity ${interaction.user.globalName} (${interaction.user.id}) from ${interaction.guild?.id}`,
      });

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      }
    }
  },
  name: Events.InteractionCreate,
};

export default interactionCreate;
