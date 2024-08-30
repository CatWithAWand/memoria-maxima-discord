import {
  type ChatInputCommandInteraction,
  type ClientEvents,
  type SlashCommandBuilder,
  type SlashCommandOptionsOnlyBuilder,
} from 'discord.js';

export interface SlashCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface Event<T extends keyof ClientEvents> {
  name: T;
  once?: boolean;
  execute(...args: ClientEvents[T]): Promise<void>;
}
