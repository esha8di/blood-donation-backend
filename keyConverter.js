const fs = require('fs');
const key = fs.readFileSync('./fir-auth-a9-ee1f1-firebase-adminsdk-fbsvc-76fe51f7e9.json', 'utf8')
const base64 = Buffer.from(key).toString('base64')
console.log(base64)