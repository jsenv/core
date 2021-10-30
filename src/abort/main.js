/*
 * When starting an http server there is two distinct things
 * that code may want to do:
 * 1. Abort the server while it's starting
 * 2. Stop server onces its started
 *
 * This can be achieved with the following code where
 * server is aborted if it takes more than 1s to start
 * and immediatly stopped once started
 *
 * const abortController = new AbortController()
 * setTimeout(() => { abortController.abort() }, 1000)
 * const server = await startServer({
 *   abortSignal: abortController.signal
 * })
 * await server.stop()
 *
 * In order to implement this kind of API two helpers are exported
 * here:
 * 1. "Abort" which can be used to throw an abort error
 *   while server is starting
 * 2. "Cleanup" which can be used to track how to cleanup all the things
 *   done to start the server
 *
 * Same concepts could be reused when spwaning a child process, a worker, etc..
 *
 */

export { Abort } from "./abort.js"
export { createCleaner } from "./cleaner.js"

// When these file will become a NPM package, this export should be Node.js only
export {
  createOperation,
  addProcessTeardownInOperationAbortSignal,
} from "./operation.js"
