import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type CacheType,
  type ChatInputCommandInteraction,
  type Collection,
  type ColorResolvable,
  EmbedBuilder,
  type FetchMessagesOptions,
  type Guild,
  type InteractionResponse,
  type Message,
  type NewsChannel,
  type NonThreadGuildBasedChannel,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextBasedChannel,
  type TextChannel,
  type User,
} from 'discord.js';

import {
  Error,
  Info,
  Loading,
  PartialSuccess,
  Success,
  Warning,
} from '@/lib/icons';
import logger from '@/lib/logger';
import { getMessageStore } from '@/lib/store';
import type { SlashCommand } from '@/types';

const messageStore = getMessageStore('obliviate');

const getStatus = (
  deleted: number,
  total: number,
): { color: ColorResolvable; icon: string; text: string } => {
  if (deleted === total)
    return { color: 'Green', icon: Success.url, text: 'Success' };

  if (deleted === 0 && total > 0)
    return { color: 'Red', icon: Error.url, text: 'Error' };

  return { color: 'Orange', icon: PartialSuccess.url, text: 'Partial Success' };
};

const createInitialEmbed = (targetUser: User): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle('Purge Messages')
    .setDescription(`Collecting user's messages...`)
    .addFields({
      name: 'Target User',
      value: `<@${targetUser.id}> (id: ${targetUser.id})`,
    })
    .setFooter({ iconURL: Loading.url, text: 'This may take a while' })
    .setColor('Blue');
};

const requestConfirmation = async (
  reply: InteractionResponse<boolean>,
  userId: string,
  messagesCount: number,
): Promise<'confirmed' | 'cancelled' | 'timeout'> => {
  const confirm = new ButtonBuilder()
    .setCustomId('confirm')
    .setLabel('Obliviate')
    .setStyle(ButtonStyle.Danger);

  const cancel = new ButtonBuilder()
    .setCustomId('cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    cancel,
    confirm,
  );

  await reply.edit({
    components: [row],
    content: `<@${userId}>`,
    embeds: [
      new EmbedBuilder()
        .setTitle('Purge Messages')
        .setDescription(
          `Found **${messagesCount}** messages. \nAre you sure you want to proceed?`,
        )
        .setColor('Orange')
        .setFooter({
          iconURL: Warning.url,
          text: 'This action cannot be undone',
        }),
    ],
  });

  try {
    const collector = await reply.awaitMessageComponent({
      filter: (i) => i.user.id === userId,
      time: 900000,
    });

    return collector.customId === 'confirm' ? 'confirmed' : 'cancelled';
  } catch (error) {
    logger.error({
      err: error,
      event: 'Command.Purge',
      msg: 'Confirmation timeout',
    });

    return 'timeout';
  }
};

const getChannel = async (
  guild: Guild,
  channelId: string,
): Promise<TextBasedChannel | null> => {
  let channel: TextBasedChannel | undefined | null = guild.channels.cache.get(
    channelId,
  ) as TextBasedChannel;

  if (!channel) {
    try {
      channel = (await guild.channels.fetch(channelId)) as TextBasedChannel;
    } catch (error) {
      logger.error({
        err: error,
        event: 'Command.Purge',
        msg: `Failed to fetch channel (channelId: ${channelId}, guildId: ${guild.id})`,
      });

      return null;
    }
  }

  return channel || null;
};

const fetchMessagesFromChannel = async (
  guildId: string,
  channel: TextBasedChannel,
  targetUser: User,
) => {
  let lastMessageId: string | null = null;
  let fetchedMessages: Collection<string, Message<boolean>>;

  do {
    const options: FetchMessagesOptions = { limit: 100 };

    if (lastMessageId) options.before = lastMessageId;

    fetchedMessages = await channel.messages.fetch(options);

    for (const msg of fetchedMessages.values()) {
      if (
        msg.author.id === targetUser.id ||
        msg.interaction?.user.id === targetUser.id
      ) {
        await messageStore.push(guildId, targetUser.id, msg);
      }
    }

    lastMessageId = fetchedMessages.last()?.id ?? null;
  } while (fetchedMessages.size === 100);
};

const fetchThreadMessages = async (
  guildId: string,
  channel: NewsChannel | TextChannel,
  targetUser: User,
): Promise<void> => {
  const activeThreads = await channel.threads.fetchActive();
  const archivedThreads = await channel.threads.fetchArchived({
    fetchAll: true,
  });

  for (const thread of [
    ...activeThreads.threads.values(),
    ...archivedThreads.threads.values(),
  ]) {
    await fetchMessagesFromChannel(guildId, thread, targetUser);
  }
};

const fetchMessagesFromAllChannels = async (
  guild: Guild,
  targetUser: User,
): Promise<void> => {
  const channels = await guild.channels.fetch();
  const textChannels = channels.filter(
    (channel): channel is NonThreadGuildBasedChannel & TextBasedChannel =>
      !!channel?.isTextBased(),
  );

  for (const channel of textChannels.values()) {
    await fetchMessagesFromChannel(guild.id, channel, targetUser);

    if ('threads' in channel) {
      await fetchThreadMessages(guild.id, channel, targetUser);
    }
  }
};

const deleteMessages = async (
  interaction: ChatInputCommandInteraction<CacheType>,
  targetUser: User,
  messagesCount: number,
  deferedReply: InteractionResponse<boolean>,
): Promise<number> => {
  let deleted = 0;
  const updateInterval = Math.max(
    5,
    Math.min(100, Math.floor(messagesCount / 20)),
  );

  while (true) {
    const msg = await messageStore.pop(interaction.guild!.id, targetUser.id);

    if (!msg) break;

    try {
      const channel = await getChannel(interaction.guild!, msg.channelId);
      await channel?.messages.delete(msg.id);
      deleted += 1;

      if (deleted % updateInterval === 0) {
        await deferedReply.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle('Purge Messages')
              .setDescription(`Deleted ${deleted}/${messagesCount} messages...`)
              .setColor('Blue')
              .setFooter({
                iconURL: Loading.url,
                text: 'This may take a while',
              }),
          ],
        });
      }
    } catch (error) {
      logger.error({
        err: error,
        event: 'Command.Purge',
        msg: `Failed to delete message (messageId: ${msg.id}, channelId: ${msg.channelId}, guildId: ${msg.guildId})`,
      });
    }
  }

  return deleted;
};

const execute: SlashCommand['execute'] = async (interaction) => {
  const startTimestamp = Date.now();
  const targetUser = interaction.options.getUser('user');

  if (!targetUser) {
    await interaction.reply({
      content: 'Could not find user',
      ephemeral: true,
    });
    return;
  }

  const deferedReply = await interaction.deferReply();
  const embedReply = createInitialEmbed(targetUser);

  await deferedReply.edit({ embeds: [embedReply] });

  await fetchMessagesFromAllChannels(interaction.guild!, targetUser);

  // Ensure we don't delete the reply message if purging the bot's messages
  if (interaction.client.user.id === targetUser.id) {
    const interactionReply = await interaction.fetchReply();
    await messageStore.delete(
      interaction.guild!.id,
      targetUser.id,
      interactionReply,
    );
  }

  const messagesCount = await messageStore.count(
    interaction.guild!.id,
    targetUser.id,
  );

  if (messagesCount === 0) {
    await deferedReply.edit({
      embeds: [
        embedReply
          .setDescription('No messages to delete found.')
          .setColor('Blue')
          .setFooter({ iconURL: Info.url, text: 'No action taken' })
          .setTimestamp(),
      ],
    });
    return;
  }

  const confirmationResult = await requestConfirmation(
    deferedReply,
    interaction.user.id,
    messagesCount,
  );

  if (confirmationResult === 'confirmed') {
    await deferedReply.edit({
      components: [],
      content: '',
      embeds: [
        embedReply
          .setDescription('Deleting...')
          .setColor('Blue')
          .setFooter({ iconURL: Loading.url, text: 'This may take a while' })
          .setTimestamp(),
      ],
    });

    const deleted = await deleteMessages(
      interaction,
      targetUser,
      messagesCount,
      deferedReply,
    );

    const elapsedTime = (Date.now() - startTimestamp) / 1000;
    const status = getStatus(deleted, messagesCount);

    await deferedReply.edit({
      embeds: [
        embedReply
          .setDescription(`Deleted ${deleted}/${messagesCount} messages`)
          .setFooter({
            iconURL: status.icon,
            text: `${status.text} (${elapsedTime.toFixed(2)} seconds)`,
          })
          .setTimestamp()
          .setColor(status.color),
      ],
    });
  } else {
    await messageStore.deleteAll(interaction.guild!.id, targetUser.id);

    const description =
      confirmationResult === 'cancelled'
        ? 'Operation cancelled.'
        : 'Confirmation timed out.';

    const footer =
      confirmationResult === 'cancelled'
        ? { iconURL: Info.url, text: 'Cancelled by user' }
        : { iconURL: Error.url, text: 'No action taken' };

    await deferedReply.edit({
      components: [],
      content: '',
      embeds: [
        embedReply
          .setDescription(description)
          .setColor(confirmationResult === 'cancelled' ? 'Blurple' : 'Red')
          .setFields([])
          .setFooter(footer)
          .setTimestamp(),
      ],
    });
  }
};

const purge: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('obliviate')
    .setDescription('Obliviates (deletes) all the messages of a user')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user whose messages will be deleted')
        .setRequired(true),
    ),
  execute,
};

export default purge;
