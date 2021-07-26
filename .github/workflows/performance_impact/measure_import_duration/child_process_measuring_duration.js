const beforeMs = Date.now()

await import(`../../../../main.js?t=${Date.now()}`)

const afterMs = Date.now()

const msEllapsed = afterMs - beforeMs

process.send({ msEllapsed })
