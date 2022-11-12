const client = require('./lib/18xxClient')
const { Game, getGamesOfInterest } = require('./lib/Game')
const discordBot = require('./lib/discordBot')
const get = require('lodash.get')
const { Player } = require('./lib/Player')
const Articles = require('articles')
const { dynamoDBLockClientFactory } = require('@deliveryhero/dynamodb-lock')
const dynamodb = require('serverless-dynamodb-client')

const lockClient = dynamoDBLockClientFactory(dynamodb.doc, {
  tableName: process.env.LOCK_STORE_TABLE,
  ttlKey: 'ttl',
  ttlInMs: 5 * 60 * 1000
})
const LOCK_GROUP = 'game'
const LOCK_ID = 'updates'

const LAST_NOTIFICATION_AT = 'notified_at'
const LAST_NOTIFIED_PLAYERS = 'notified'

const WEBHOOK_REGEX = new RegExp(/^<@(?<playerId>\d+)> (?<updateMessage>.+)\\n(?<gameURL>https?:\/\/18xx\.games\/game\/(?<gameId>\d+))$/)

module.exports.push = async (event) => {
  console.debug('Received webhook', event, WEBHOOK_REGEX.exec(event.body.text))
  if (event.body.text) {
    const webhookContents = WEBHOOK_REGEX.exec(event.body.text)
    if (webhookContents != null) {
      console.debug(`Attempting to get lock`, {LOCK_ID, LOCK_GROUP,})
      const lock = await lockClient.lock(LOCK_GROUP, LOCK_ID, { leaseDurationInMs: 5000, prolongEveryMs: 2000 })
      const playerId = webhookContents.groups.playerId
      const updateMessage = webhookContents.groups.updateMessage
      const gameId = webhookContents.groups.gameId

      try {
        if (playerId && gameId && updateMessage.includes('Your Turn')) {
          const gameData = (await client.get(`/game/${gameId}`)).data
          const game = new Game(gameId)
          let lastUpdated = 0
          const eventTimestamp = event.requestContext.timeEpoch
          if (await game.exists()) {
            lastUpdated = game.gameData.updated_at * 1000 // Convert epoch to MS
          }

          if (lastUpdated < eventTimestamp) {
            console.log(`Sending notification in response to webhook for game ${gameId}`)
            await game.put(gameData)
            await sendNotification(game)
          } else {
            const timestampDifferenceInSec = Math.floor((eventTimestamp - lastUpdated) / 1000)
            console.warn(`Webhook appears to be stale, found game data that is ${timestampDifferenceInSec} seconds newer`)
          }
        }
      } finally {
        await lockClient.releaseLock(lock)
      }
    }
  }
}

module.exports.poll = async (event) => {
  const lock = await lockClient.lock(LOCK_GROUP, LOCK_ID, { leaseDurationInMs: 20000, prolongEveryMs: 5000 })

  try {
    const relevantGames = await getGamesOfInterest()
    console.debug('Relevant games from the db', relevantGames)
    console.log(`Identified ${relevantGames.length} active games`)

    const response = (await client.get('/game')).data
    console.debug('Current game data from 18xx', response)
    const currentGamesData = response.games
    console.log(`Got data for ${currentGamesData.length} current games from 18xx`)

    const currentRelevantGamesData = relevantGames
      .filter((currentGameData) => relevantGames
        .some((relevantGame) => relevantGame.gameId === currentGameData.id && relev))
    console.log(`Found current data for ${currentRelevantGamesData.length} relevant games`)

    const missedRelevantGamesData = await Promise.all(relevantGames
      .filter((relevantGame) => !currentRelevantGamesData
        .some((currentGameData) => relevantGame.gameId === currentGameData.id))
      .map(async (missedGame) => {
        console.info(`Did not find data for game ${missedGame.gameId} in relevant games, fetching from 18xx`)
        return (await client.get(`/game/${missedGame.gameId}`)).data
      }))
    console.log(`Got specific data for ${missedRelevantGamesData.length} relevant games`)

    const sendOutgoingMessagesForGamesPromises = await Promise.all(currentRelevantGamesData.concat(missedRelevantGamesData)
      .map(async (currentGameData) => {
        const game = relevantGames.find((relevantGame) => relevantGame.gameId === currentGameData.id)
        const lastUpdated = game.gameData.updated_at || 0
        const existingActingPlayer = get(game, 'gameData.acting[0]')
        const existingStatus = game.gameData.status

        if (currentGameData.updated_at > lastUpdated) {
          await game.put(currentGameData)

          // Check if game status has changed
          if (existingStatus !== currentGameData.status) {
            return sendNotification(game)
          }
          
          // Check if acting player has changed
          const currentActingPlayer = get(currentGameData, 'acting[0]')
          
          const hasActingPlayerChanged = currentActingPlayer != null && currentActingPlayer !== existingActingPlayer
          console.debug(`For game#${game.gameId} I think the acting player has ` + 
            `${hasActingPlayerChanged ? 'changed' : 'not changed'} because the current acting player is ` + 
            `${currentActingPlayer} and the previous one was ${existingActingPlayer}`)
          if (hasActingPlayerChanged) {
            return sendNotification(game)
          }

          // Check if new actions have been taken by someone that isn't the last acting player
          // Get full game data if we don't already have it
          if (get(currentGameData, 'actions.length') === 0) {
            currentGameData = (await client.get(`/game/${currentGameData.id}`)).data
          }
          const newPlayerActionsExist = currentGameData.actions.some((action) => {
            return action.entity_type === 'player'
              && action.created_at > lastUpdated
              && action.entity !== existingActingPlayer
          })
          if (newPlayerActionsExist) {
            return sendNotification(game)
          }
        }
        return null
      }))
    const updatedGamesCount = sendOutgoingMessagesForGamesPromises.filter((p) => p != null).length
    console.log(`Sent updates for ${updatedGamesCount} games`)
  } finally {
    lockClient.releaseLock(lock)
  }

  return {
    statusCode: 201
  };
};

async function sendNotification(game) {
  const subscriptions = await game.getSubscriptions()
  console.log(`Found ${subscriptions.length} for game #${game.gameId}`)
  await game.put({[LAST_NOTIFICATION_AT]: Math.floor(Date.now() / 1000), [LAST_NOTIFIED_PLAYERS]: game.gameData.acting})
  await Promise.all(subscriptions.map(async (subscription) => {
    const msg = await buildGameUpdateMessage(game)
    if (msg) {
      console.log(`Sending message to channel ${subscription.channelId} in guild ${subscription.guildId} with content: ${msg}`)
      return discordBot.sendMessage(subscription.guildId, subscription.channelId, msg)
    } else {
      console.warn(`Game #${game.gameId} has no valid messages to send`)
    }
  }))
  return game
}

async function buildGameUpdateMessage(game) {
  const data = game.gameData
  if (data.status === 'active') {
    return buildGameUpdateMessageForActiveGame(game)
  } else if (data.status === 'finished') {
    return buildGameUpdateMessageForFinishedGame(game)
  }
}

async function buildGameUpdateMessageForActiveGame(game) {
  const data = game.gameData
  const activePlayerId = get(data, 'acting[0]')
  const activePlayerDiscordTag = await getDiscordMentionForPlayerId(activePlayerId)
  const activePlayerName = data.players.find((player) => player.id === activePlayerId).name
  return `https://18xx.games/game/${data.id} is on ${Articles.articlize(data.round)} and it is ${activePlayerDiscordTag || activePlayerName}'s turn.`
}

async function buildGameUpdateMessageForFinishedGame(game) {
  let gameResultMsg = ''
  const data = game.gameData
  const result = data.result
  if (result && Object.getOwnPropertyNames(result).length) {
    const playerResults = (await promise.all(Object.getOwnPropertyNames(result).map(async (playerId) => {
      const playerScore = parseInt(result[playerId])
      const playerName = data.players.find((player) => player.id === playerId).name
      return { id: playerId, score: playerScore, name: playerName, mention: await getDiscordMentionForPlayerId(playerId)}
    }))).sort((a, b) => a.score - b.score)

    gameResultMsg = 'The final scores are: ' + playerResults.reduce((scores, player, i) => {
      const isLastPlayer = i === (playerResults.length - 1)
      return scores + `${player.mention || player.playerName} with a score of ${player.score}` 
        + isLastPlayer ? '!' : ','
    }, '')
  }
  return `https://18xx.games/game/${data.id} is now finished. ` + gameResultMsg
}


async function getDiscordMentionForPlayerId(id) {
  const player = new Player(id)
  if (await player.exists()) {
    return player.playerData.discordTag || null
  }
  return null
}
