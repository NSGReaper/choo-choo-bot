const {once} = require('events');
const { SlashCreator } = require('slash-create');

const registerGame = require('./commands/registerGame')
const registerPlayer = require('./commands/registerPlayer')

module.exports.hello = async (event) => {
  console.log(JSON.stringify(event, null, 2))
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v3.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  }
}

module.exports.createCommands = async (event) => {
  const creator = new SlashCreator({
      applicationID: process.env.DISCORD_APP_ID,
      publicKey: process.env.DISCORD_PUBLIC_KEY,
      token: process.env.DISCORD_BOT_TOKEN,
      allowedMentions: { everyone: false, roles: true, users: true }
  });

  creator.on('debug', console.debug)
  creator.on('warn', console.warn)
  creator.on('error', console.error)

  const synced = once(creator, 'synced')

  
  creator
    //.registerCommandsIn(path.join(__dirname, 'commands'))
    .registerCommands([registerGame, registerPlayer])
    .syncCommands()

  await synced
}
