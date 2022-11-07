const client = require('./lib/18xxClient')
const { Game, getGamesOfInterest } = require('./lib/Game')

module.exports.poll = async (event) => {
  const relevantGames = getGamesOfInterest()
  console.log(`Identified ${relevantGames.length} active games`)
  const currentGamesData = await client.get('/game')
  console.log(`Got data for ${games.length} current games from 18xx`)

  const currentRelevantGamesData = currentGamesData
    .filter((currentGameData) => relevantGames
      .some((relevantGame) => relevantGame.game_id === currentGameData.id))

  currentRelevantGamesData.forEach((currentGameData) => {
    const game = relevantGames.find((relevantGame) => relevantGame.game_id === currentGameData.id)
    game.put(currentGameData)
  })

  const missedRelevantGames = relevantGames
    .filter((relevantGame) => currentRelevantGamesData
      .some((currentGameData) => relevantGame.game_id === currentGameData.id))
  missedRelevantGames.forEach((missedGame) => console.error(`Did not find data for game ${missedGame.game_id}`))
  
      
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: `Found data for ${currentRelevantGamesData.length} games. Missing data for ${missedRelevantGames.length} games.`,
        input: event,
      },
      null,
      2
    ),
  };
};
