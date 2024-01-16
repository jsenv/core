/*
 * This file is the entry point of this codebase
 * - It is responsible to export the documented API
 * - It should be kept simple (just re-export) to help reader to
 *   discover codebase progressively
 */

export { createLogger } from "./logger.js";

// formatting messages
export { createDetailedMessage } from "./detailed_message.js";
// dynamic logs (log that can update themselves in the terminal)
export { createDynamicLog } from "./dynamic_log.js";
export { startSpinner } from "./spinner.js";
export { createTaskLog } from "./task_log.js";
