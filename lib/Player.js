const dynamodb = require('serverless-dynamodb-client')
 
const docClient = dynamodb.doc;  // return an instance of new AWS.DynamoDB.DocumentClient()

const TableName = process.env.DYNAMODB_PLAYERS_TABLE
const PLAYER_ID = 'player_id'

class Player {
    constructor (playerId, playerData) {
        this.playerId = playerId
        this.playerData = playerData
    }

    exists() {
        if (!this.playerData) {
            return this.get(true) != null
        }
        return true
    }

    get(alwaysFresh = false) {
        if (!alwaysFresh && this.playerData != null) {
            return this.playerData
        }
        this.playerData = getPlayerFromDB(this.playerDataId)
        return this.playerData
    }

    put(player) {
        if (!this.exists()) {
            this.playerData = player
            putPlayerInDB(player)
        } else if (player.updated_at > this.playerData.updated_at) {
            this.playerData = Object.assign(this.playerData, player)
        } else {
            console.log('No change detected in player, not updating db')
        }
    }
}
module.exports.Player = Player

function getAllPlayers() {
    // TODO: implement
}

function getPlayerFromDB(playerId) {
    var params = {
        TableName,
        Key: {[PLAYER_ID]: playerId}
    }

    docClient.get(params, function(err, data) {
        if (err) {
         throw Error('Could not get player from db', err)
        } else {
          console.log('Successfully got player from dn', data.Item);
          return data.Item
        }
    })
}

function putPlayerInDB(playerId, playerData) {
    var params = {
        TableName,
        Item: {
            [PLAYER_ID]: playerId,
            state: playerData
        }
    }

    docClient.get(params, function(err, data) {
        if (err) {
         throw Error('Could not get player from db', err)
        } else {
          console.log('Successfully got player from dn', data.Item);
          return data.Item
        }
    })
}

module.exports.getPlayerByName = () => {
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

module.exports.registerPlayer = async (playerId, discordId) => {
    const player = new Player(playerId)
    if (!player.exists()) {
        player.put({
            discordId
        })
    } else {
        throw new Error(`Player Id ${playerId} is already registered`)
    }
}
