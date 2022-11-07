const path = require('path');
const { AWSLambdaServer, SlashCreator } = require('slash-create');

const creator = new SlashCreator({
    applicationID: process.env.DISCORD_APP_ID,
    publicKey: process.env.DISCORD_PUBLIC_KEY,
    token: process.env.DISCORD_BOT_TOKEN
});

creator
    // The first argument is required, the second argument is the name or "target" of the export.
    // It defaults to 'interactions', so it would not be strictly necessary here.
    .withServer(new AWSLambdaServer(module.exports, 'interactions'))
    .registerCommandsIn(path.join(__dirname, 'commands'))
    .syncCommands();
