/* eslint-env browser */
const jsUrl = new URL("./file.js", import.meta.url)
const jsModuleUrl = new URL("./file.js?module", import.meta.url)

export const jsUrlInstanceOfUrl = jsUrl instanceof URL

export const jsUrlString = String(jsUrl)

const modulePromise = import(jsModuleUrl)
export { modulePromise }
