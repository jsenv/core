import fetch from "node-fetch"
import https from "https"

https.globalAgent.options.rejectUnauthorized = false

global.fetch = fetch
