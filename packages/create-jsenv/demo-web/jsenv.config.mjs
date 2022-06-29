/*
 * This file exports configuration reused by jsenv scripts such as
 * - scripts/test.mjs
 * - scripts/build.mjs
 */

export const rootDirectoryUrl = new URL("./", import.meta.url)
