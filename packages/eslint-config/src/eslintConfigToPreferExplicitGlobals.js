/*
 * ESLint rightfully consider some globals as available but in practice it prevents to catch bugs.
 * It's better for human devs to configure ESLint so that "close" or "event" are undefined by default.
 * If one day code needs to use the global variable you can still write window.close or window.event.
 *
 * See also
 * - https://github.com/eslint/eslint/blob/00d2c5be9a89efd90135c4368a9589f33df3f7ba/conf/environments.js#L1
 * - https://github.com/sindresorhus/globals/blob/a1d32c7f76e4d1ac3c8883acf075db11bd4d44f9/globals.json#L1
 *
 */

export const eslintConfigToPreferExplicitGlobals = {
  globals: {
    alert: "off",
    atob: "off",
    blur: "off",
    btoa: "off",
    caches: "off",
    close: "off",
    closed: "off",
    crypto: "off",
    defaultstatus: "off",
    defaultStatus: "off",
    escape: "off",
    event: "off",
    external: "off",
    focus: "off",
    find: "off",
    frames: "off",
    history: "off",
    length: "off",
    location: "off",
    menubar: "off",
    name: "off",
    navigator: "off",
    open: "off",
    origin: "off",
    print: "off",
    screen: "off",
    scroll: "off",
    status: "off",
    stop: "off",
    top: "off",
    unescape: "off",
    valueOf: "off",
  },
}
