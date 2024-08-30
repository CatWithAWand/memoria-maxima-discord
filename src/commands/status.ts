import { type Client, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { Info } from '@/lib/icons';
import { getRedisVitals } from '@/lib/store';
import type { SlashCommand } from '@/types';
import { formatUptime } from '@/utils/time';

const formatRedisVitals = (
  vitals: Awaited<ReturnType<typeof getRedisVitals>>,
): string => {
  const fields = [
    ['Uptime', formatUptime(vitals.uptime * 1000)],
    ['Connected Clients', vitals.connectedClients],
    ['Memory Usage', vitals.usedMemoryHuman],
    ['Memory Peak', vitals.usedMemoryPeakHuman],
    ['Dataset', vitals.datasetHuman],
    ['Memory Fragmentation', vitals.memFragmentationRatio.toFixed(2)],
    ['CPU Usage', `${vitals.cpuUsage.toFixed(2)}%`],
    ['Total Commands', vitals.totalCommands],
    ['Ops/sec', vitals.opsPerSec],
    [
      'Keyspace',
      `${vitals.totalKeys} keys (${vitals.keyspaceHits} hits, ${vitals.keyspaceMisses} misses)`,
    ],
  ];

  return fields.map(([key, value]) => `${key}: ${value}`).join('\n');
};

const createStatusEmbed = (
  client: Client<true>,
  redisVitals: Awaited<ReturnType<typeof getRedisVitals>>,
  responseTime: number,
): EmbedBuilder => {
  const formattedVitals = formatRedisVitals(redisVitals);
  const formattedUptime = formatUptime(client.uptime, true);

  return new EmbedBuilder()
    .setTitle('Bot Status')
    .addFields(
      {
        name: 'Identity',
        value: `${client.user.tag}\n(id: ${client.application.id})`,
      },
      { name: 'WebSocket', value: `${client.ws.ping} ms` },
      { name: 'Response Time', value: `${responseTime} ms` },
      { name: 'Uptime', value: formattedUptime },
      { name: 'Redis Vitals', value: formattedVitals },
    )
    .setFooter({ iconURL: Info.url, text: 'Online' })
    .setTimestamp()
    .setColor('Blurple');
};

const execute: SlashCommand['execute'] = async (interaction) => {
  const deferredReply = await interaction.deferReply({ fetchReply: true });
  const responseTime =
    deferredReply.createdTimestamp - interaction.createdTimestamp;

  const redisVitals = await getRedisVitals();
  const embedReply = createStatusEmbed(
    interaction.client,
    redisVitals,
    responseTime,
  );

  await interaction.editReply({ embeds: [embedReply] });
};

const status: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription("Check the bot's status"),
  execute,
};

export default status;
