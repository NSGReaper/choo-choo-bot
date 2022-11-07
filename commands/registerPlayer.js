const { SlashCommand, CommandOptionType } = require('slash-create');
const { registerPlayer } = require('../lib/Player')

module.exports = class RegisterPlayerCommand extends SlashCommand {
  constructor(creator) {
    super(creator, {
      name: 'player',
      description: 'Says hello to you.',
      options: [{
        type: CommandOptionType.NUMBER,
        name: 'id',
        description: 'Enter your 18xx player id',
        required: true,
        autocomplete: false // TODO: implement
      }]
    });

    this.filePath = __filename;
  }

  async run(ctx) {
    const playerId = ctx.options.player
    const discordId = ctx.member.user.username

    registerPlayer(playerId, discordId)

    return `> Hello @${discordId}!`;
  }
}
