import https from "https"
import fetch from "node-fetch"

https.globalAgent.options.rejectUnauthorized = false

global.fetch = fetch
