/*
 * This file is the entry point of this codebase
 * - It is responsible to export the documented API
 * - It should be kept simple (just re-export) to help reader to
 *   discover codebase progressively
 */

export { createLogger } from "./logger.js";

// color and symbols
export { ANSI } from "./ansi.js";
export { UNICODE } from "./unicode.js";

// formatting messages
export { createDetailedMessage } from "./detailed_message.js";
export { msAsEllapsedTime, msAsDuration } from "./duration_log.js";
export { byteAsFileSize, byteAsMemoryUsage } from "./size_log.js";
export { distributePercentages } from "./percentage_distribution.js";
export {
  getPrecision,
  setRoundedPrecision,
  setFlooredPrecision,
  setCeiledPrecision,
  setPrecision,
} from "./decimals.js";

// dynamic logs (log that can update themselves in the terminal)
export { createLog } from "./log.js";
export { startSpinner } from "./spinner.js";
export { createTaskLog } from "./task_log.js";
