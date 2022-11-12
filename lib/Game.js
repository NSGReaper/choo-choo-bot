const dynamodb = require('serverless-dynamodb-client')
const client = require('./18xxClient')
const get = require('lodash.get')

const docClient = dynamodb.doc;  // return an instance of new AWS.DynamoDB.DocumentClient()

const TableName = process.env.DYNAMODB_GAMES_TABLE
const GAME_ID = 'game_id'
const TTL = 'ttl'
const STALE_TIME_SEC = 5 * 60 * 60

class Game {
    constructor (gameId, gameData = {}) {
        this.gameId = parseInt(gameId)
        this.gameData = gameData
    }

    async exists() {
        if (!this.gameData || Object.keys(this.gameData).length === 0) {
            return (await this.get(true)) != null
        }
        return true
    }

    async get(alwaysFresh = false) {
        if (!this.gameData) {
            const CURRENT_TIMESTAMP_SEC = Math.floor(Date.now() / 1000)
            const isFresh = this.gameData.updated_at > (CURRENT_TIMESTAMP_SEC - STALE_TIME_SEC)
            if (!alwaysFresh && isFresh) {
                return this.gameData
            }
        }
        this.gameData = await getGameFromDB(this.gameDataId)
        return this.gameData
    }

    async put(game) {
        if (!(await this.exists())) {
            this.gameData = game
            await putGameInDB(this.gameId, game)
        } else if (game.updated_at > this.gameData.updated_at || get(game, 'subscriptions.length') > get(this.gameData, 'subscriptions.length')) {
            this.gameData = Object.assign(this.gameData, game)
            await putGameInDB(this.gameId, this.gameData)
        } else {
            console.log('No change detected in game, not updating db')
        }
    }

    async getSubscriptions() {
        let subscriptions = []
        if ((await this.exists()) && this.gameData.subscriptions) {
            subscriptions = this.gameData.subscriptions
        }

        return subscriptions
    }
}
module.exports.Game = Game

module.exports.getGamesOfInterest = async () => {
    var params = {
        ExpressionAttributeValues: {
            ':s': 'active'
        },
        ExpressionAttributeNames: {
            '#s': 'status'
        },
        FilterExpression: '#s = :s',
        TableName
    }

    try {
        const data = await docClient.scan(params).promise()
        console.log('Successfully retrieved games of interest', data);
        return data.Items.map((gameData) => new Game(gameData.id, gameData))
    } catch (err) {
        console.error('Could not find any games due to an error', err)
        return []
    }
}

module.exports.registerGame = async (gameId, initialGameData) => {
    const game = new Game(gameId)
    if (!(await game.exists())) {
        const { data } = await client.get(`/game/${gameId}`)
        console.log('Received gameData from 18xx', data)
        await game.put(Object.assign({}, initialGameData, data))
    } else {
        console.debug(`Updating game ${game.gameId} with new subscriptions`, 
            {current: game.gameData, new: initialGameData})
        if (Array.isArray(game.gameData.subscriptions) && Array.isArray(initialGameData.subscriptions)) {
            const subscriptions = [...new Map(game.gameData.subscriptions.concat(initialGameData.subscriptions).map(item => [item[key], item])).values()] // Unique subscriptions
            await game.put(Object.assign(initialGameData, {subscriptions}))
        } else {
            await game.put(initialGameData)
        }
    }
}

async function getGameFromDB(gameId) {
    var params = {
        TableName,
        Key: {[GAME_ID]: gameId}
    }

    try {
        const data = await docClient.get(params).promise()
        console.log('Successfully got game from dn', data);
        return data.Item
    } catch (err) {
        console.warn('Could not get game from db', err)
        return null
    }
}

async function putGameInDB(gameId, gameData) {
    var params = {
        TableName,
        Item: Object.assign({
            [GAME_ID]: gameId,
            [TTL]: getTTL(gameData),
        }, gameData)
    }

    try {
        const data = await docClient.put(params).promise()
        console.log('Successfully put game in db. Game #', gameId);
        return true
    } catch (err) {
        console.error('Could not put game in db', err.stack)
        throw Error('Could not put game in db. ' + err.toString())
    }
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
