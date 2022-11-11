const dynamodb = require('serverless-dynamodb-client')
 
const docClient = dynamodb.doc;  // return an instance of new AWS.DynamoDB.DocumentClient()

const TableName = process.env.DYNAMODB_PLAYERS_TABLE
const PLAYER_ID = 'player_id'

class Player {
    constructor (playerId, playerData) {
        this.playerId = parseInt(playerId)
        this.playerData = playerData
    }

    async exists() {
        if (!this.playerData) {
            return (await this.get(true)) != null
        }
        return true
    }

    async get(alwaysFresh = false) {
        if (!alwaysFresh && this.playerData != null) {
            return this.playerData
        }
        this.playerData = await getPlayerFromDB(this.playerId)
        return this.playerData
    }

    async put(player) {
        if (!(await this.exists())) {
            this.playerData = player
            await putPlayerInDB(this.playerId, player)
        } else if (player.updated_at > this.playerData.updated_at) {
            this.playerData = Object.assign(this.playerData, player)
            await putPlayerInDB(this.playerId, player)
        } else {
            console.log('No change detected in player, not updating db')
        }
    }
}
module.exports.Player = Player

function getAllPlayers() {
    // TODO: implement
}

async function getPlayerFromDB(playerId) {
    var params = {
        TableName,
        Key: {[PLAYER_ID]: playerId}
    }

    try {
        const data = await docClient.get(params).promise()
        console.log('Successfully got player from db', data.Item);
        return data.Item
    } catch (err) {
        console.warn('Could not get player from db', err)
        return null
    }
}

async function putPlayerInDB(playerId, playerData) {
    var params = {
        TableName,
        Item: Object.assign({
            [PLAYER_ID]: playerId,
        }, playerData)
    }

    try {
        const data = await docClient.put(params).promise()
        console.log('Successfully put player in db. Player #', playerId);
        return data.Item
    } catch (err) {
        console.error('Could not put player in db', err.stack)
        throw Error('Could not put player in db. ' + err.toString())
    }
}

module.exports.getPlayerByName = async (name) => {
    var params = {
        ExpressionAttributeValues: {
          ':n': name,
        },
        ExpressionAttributeNames: {
            '#n': 'name'
        },
        KeyConditionExpression: '#n = :n',
        TableName
    }
    try {
        const data = await docClient.query(params).promise()
        console.log("Success", data.Items);
        return data.Items.map((playerData) => new Player(playerData.id, playerData))
    } catch (err) {
        console.error(`Could not find player with name ${name}`, err.stack)
        return null
    }
}

module.exports.registerPlayer = async (playerId, discordId, discordTag) => {
    const player = new Player(playerId)
    if (!(await player.exists())) {
        await player.put({
            id: playerId,
            discordId,
            discordTag
        })
    } else {
        throw new Error(`Player Id ${playerId} is already registered`)
    }
}
