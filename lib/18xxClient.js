const axios = require('axios')

module.exports.default = axios.create({
    baseURL: 'https://18xx.games/api/',
    responseType: 'json'
})
