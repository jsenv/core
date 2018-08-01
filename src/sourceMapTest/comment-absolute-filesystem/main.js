// simulate what System.import is doing on nodejs
// aka getting the file content and evaluating it

const fs = require("fs")

const source = fs.readFileSync(`${__dirname}/file.es5.js`).toString()
;(0, eval)(source)
