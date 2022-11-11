const { SlashCommand, CommandOptionType } = require('slash-create');
const { registerPlayer } = require('../lib/Player')

module.exports = class RegisterPlayerCommand extends SlashCommand {
  constructor(creator) {
    super(creator, {
      name: 'addplayer',
      description: 'Links your 18xx player to your discord username.',
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
    const playerId = ctx.options.id
    const discordId = ctx.member.user.id
    const discordTag = ctx.member.mention

    registerPlayer(playerId, discordId, discordTag)

    ctx.send(`> Hello ${discordTag}! I will now tag you when I mention 18xx player https://18xx.games/profile/${playerId}.`)
  }
}
