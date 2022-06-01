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
export { createTaskLog } from "./src/task_log.js"
export { msAsDuration } from "./src/duration_log.js"
export { byteAsFileSize, byteAsMemoryUsage } from "./src/size_log.js"
export { distributePercentages } from "./src/percentage_distribution.js"

export { roundNumber, setPrecision, getPrecision } from "./src/decimals.js"
