/*
 * This file is the entry point of this codebase
 * - It is responsible to export the documented API
 * - It should be kept simple (just re-export) to help reader to
 *   discover codebase progressively
 */

export { assert } from "./assert.js";
export { isAssertionError, createAssertionError } from "./assertionError.js";
