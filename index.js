const { AWSLambdaServer, SlashCreator } = require('slash-create');

const registerGame = require('./commands/registerGame')
const registerPlayer = require('./commands/registerPlayer')

const creator = new SlashCreator({
    applicationID: process.env.DISCORD_APP_ID,
    publicKey: process.env.DISCORD_PUBLIC_KEY,
    token: process.env.DISCORD_BOT_TOKEN,
    allowedMentions: { everyone: false, roles: true, users: true }
});

creator.on('debug', console.debug)
creator.on('warn', console.warn)
creator.on('error', console.error)
creator.on('rawRequest', (req) => {
    console.debug("Raw Request:", JSON.stringify(req));
})
creator.on('unverifiedRequest', (req) => {
    console.error("Unverified Request:", JSON.stringify(req));
})
creator.on('commandInteraction', (interaction) => {
    console.debug("Command:", JSON.stringify(interaction));
})
creator.on('commandRun', (command, prm, ctx) => {
    console.debug("Command Run:", JSON.stringify({command, ctx}, null, 2));
})
creator.on('commandError', (command, err, ctx) => {
    console.debug("Command Error:", JSON.stringify({command, err, ctx}, null, 2));
})

creator
    // The first argument is required, the second argument is the name or "target" of the export.
    // It defaults to 'interactions', so it would not be strictly necessary here.
    .withServer(new AWSLambdaServer(module.exports, 'interactions'))
    .registerCommands([registerGame, registerPlayer])
    //.registerCommandsIn(path.join(__dirname, 'commands'))

setTimeout(() => { console.log(module.exports) }, 10)
