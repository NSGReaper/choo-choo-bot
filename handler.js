const path = require('path');
const {once} = require('events');
const { AWSLambdaServer, SlashCreator } = require('slash-create');

const creator = new SlashCreator({
    applicationID: process.env.DISCORD_APP_ID,
    publicKey: process.env.DISCORD_PUBLIC_KEY,
    token: process.env.DISCORD_BOT_TOKEN
});

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
  };
};


module.exports.createCommands = async (event) => {
  const synced = once(creator, 'synced')
  creator
    .registerCommandsIn(path.join(__dirname, 'commands'))
    .syncCommands()

  await synced
}
