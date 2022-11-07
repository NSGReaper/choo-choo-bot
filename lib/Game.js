const dynamodb = require('serverless-dynamodb-client')
const client = require('./18xxClient')
 
const docClient = dynamodb.doc;  // return an instance of new AWS.DynamoDB.DocumentClient()

const TableName = 'games'
const GAME_ID = 'game_id'
const TTL = 'ttl'
const STALE_TIME_SEC = 5 * 60 * 60

class Game {
    constructor (gameId, gameData) {
        this.gameId = gameId
        this.gameData = gameData
    }

    exists() {
        if (!this.gameData) {
            return this.get(true) != null
        }
        return true
    }

    get(alwaysFresh = false) {
        if (this.gameData != null) {
            const CURRENT_TIMESTAMP_SEC = Math.floor(Date.now() / 1000)
            const isFresh = this.gameData.updated_at > (CURRENT_TIMESTAMP_SEC - STALE_TIME_SEC)
            if (!alwaysFresh && isFresh) {
                return this.gameData
            }
        }
        this.gameData = getGameFromDB(this.gameDataId)
        return this.gameData
    }

    put(game) {
        if (!this.exists()) {
            this.gameData = game
            putGameInDB(game)
        } else if (game.updated_at > this.gameData.updated_at) {
            this.gameData = Object.assign(this.gameData, game)
        } else {
            console.log('No change detected in game, not updating db')
        }
    }
}
module.exports.Game = Game

module.exports.getGamesOfInterest = () => {
    var params = {
        ExpressionAttributeValues: {
          ':s': 'active',
        },
       KeyConditionExpression: 'status = :s',
       TableName
      }
      
      docClient.query(params, function(err, data) {
        if (err) {
          console.log("Error", err);
        } else {
          console.log("Success", data.Items);
          return data.Items.map((gameData) => new Game(gameData.id, gameData))
        }
      })
}

module.exports.registerGame = async (gameId, initialGameData) => {
    const game = new Game(gameId)
    if (!game.exists()) {
        const gameData = await client.get(`/game/${gameId}`)
        game.put(...initialGameData, ...gameData)
    } else {
        game.put(initialGameData)
    }
}

function getGameFromDB(gameId) {
    var params = {
        TableName,
        Key: {[GAME_ID]: gameId}
    }

    docClient.get(params, function(err, data) {
        if (err) {
         throw Error('Could not get game from db', err)
        } else {
          console.log('Successfully got game from dn', data.Item);
          return data.Item
        }
    })
}

function putGameInDB(gameId, gameData) {
    var params = {
        TableName,
        Item: {
            [GAME_ID]: gameId,
            [TTL]: getTTL(gameData),
            state: gameData
        }
    }

    docClient.get(params, function(err, data) {
        if (err) {
         throw Error('Could not get game from db', err)
        } else {
          console.log('Successfully got game from dn', data.Item);
          return data.Item
        }
    })
}

const ONE_YEAR_IN_SEC = 1 * 365 * 24 * 60 * 60
const ONE_DAY_IN_SEC = 1 * 30 * 24 * 60 * 60
function getTTL(game) {
    const CURRENT_TIMESTAMP_SEC = Math.floor(Date.now() / 1000)
    if (game.status === 'finished') {
        return CURRENT_TIMESTAMP_SEC + ONE_DAY_IN_SEC
    }
    return CURRENT_TIMESTAMP_SEC + ONE_YEAR_IN_SEC
}
