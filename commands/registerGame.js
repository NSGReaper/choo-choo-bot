const { SlashCommand, CommandOptionType } = require('slash-create');
const { registerGame } = require('../lib/Game')

module.exports = class RegisterGameCommand extends SlashCommand {
  constructor(creator) {
    super(creator, {
      name: 'addgame',
      description: 'Registers an 18xx game to post announcements in this channel.',
      dmPermission: false,
      options: [{
        type: CommandOptionType.NUMBER,
        name: 'id',
        description: 'Enter the 18xx game id',
        required: true
      }]
    });

    this.filePath = __filename;
  }

  async run(ctx) {
    const gameId = ctx.options.id
    const guildId = ctx.guildID
    const channelId = ctx.channelID

    registerGame(gameId, {
        subscriptions: [{guildId, channelId}]
    })

    ctx.send(`> Hello ${ctx.member.mention}! I will post updates for https://18xx.games/game/${gameId} in this channel.`)
  }
}
