import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REST, Routes } from 'discord.js';

import logger from '@/lib/logger.js';
import { addCommand, getAllCommands } from '@/lib/store';
import type { SlashCommand } from '@/types';

enum DeployCommandsResult {
  Success = 'Success',
  Error = 'Error',
}

const loadCommands = async (): Promise<void> => {
  const filename = fileURLToPath(import.meta.url);
  const commandsPath = path.join(path.dirname(filename), '../commands');
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = (await import(filePath)).default as SlashCommand;

    if ('data' in command && 'execute' in command) {
      addCommand(command.data.name, command);
    } else {
      logger.warn({
        event: 'CommandLoad',
        msg: `The command at ${filePath} is missing a required "data" or "execute" property`,
      });
    }
  }
};

const deployCommands = async (
  token: string,
  clientId: string,
): Promise<DeployCommandsResult> => {
  try {
    const commands = getAllCommands();

    logger.info({
      event: 'DeployCommands',
      msg: `Started deploying ${commands.size} application slash commands`,
    });

    const commandsData = commands.map((command) => command.data.toJSON());
    const rest = new REST().setToken(token);
    const data: any = await rest.put(Routes.applicationCommands(clientId), {
      body: commandsData,
    });

    logger.info({
      event: 'DeployCommands',
      msg: `Successfully deployed ${data.length}/${commands.size} application slash commands`,
    });

    return DeployCommandsResult.Success;
  } catch (error) {
    logger.error({
      err: error,
      event: 'DeployCommands',
      msg: 'Failed to deploy application slash commands',
    });
    return DeployCommandsResult.Error;
  }
};

export { deployCommands, loadCommands };
