/*
 * This file is the entry point of this codebase
 * - It is responsible to export the documented API
 * - It should be kept simple (just re-export) to help reader to
 *   discover codebase progressively
 */

export { ANSI } from "./src/ansi.js"
export { UNICODE } from "./src/unicode.js"
export { createLog } from "./src/log.js"
export { startSpinner } from "./src/spinner.js"
