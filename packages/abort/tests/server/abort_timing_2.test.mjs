import { startServer } from "./test_helpers.mjs"

const abortController = new AbortController()

const serverPromise = startServer({ signal: abortController.signal })
const { server } = await serverPromise

abortController.abort() // has no effect
server.unref()
