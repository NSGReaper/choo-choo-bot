const axios = require('axios')

const client = axios.create({
    baseURL: 'https://18xx.games/api/',
    responseType: 'json'
})
module.exports = client
