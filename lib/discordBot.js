const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.GuildMessages] });

client.on('ready', async () => {
  console.log(`Logged in to discord as ${client.user.tag}!`)

  const guilds = await client.guilds.fetch()
  console.log(`I'm a member of so many guilds!`, guilds.map((guild) => guild.name))
})

if (!process.env.IS_OFFLINE) {
  client.login(process.env.DISCORD_BOT_TOKEN)
}

async function getChannel(guildId, channelId) {
    const guild = await client.guilds.fetch(client.guilds.resolveId(guildId))
    const guildChannel = await guild.channels.fetch(guild.channels.resolveId(channelId))

    return guildChannel
}
module.exports.getChannel = getChannel

async function sendMessage(guildId, channelId, message) {
    if (!process.env.IS_OFFLINE) {
      const guildChannel = await getChannel(guildId, channelId)
      return guildChannel.send(message)
    } else {
      console.debug('OFFLINE MODE', {guildId, channelId, message})
    }
}
module.exports.sendMessage = sendMessage
