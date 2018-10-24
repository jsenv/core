import { getBrowserSystemSource } from "@dmail/module-loader"
import { compileResultToFileSysten } from "./fileHelper.js"
import { compileForBrowser } from "./platform/index.js"

export const getBrowserSystemRemoteURL = ({ remoteRoot, compileInto }) => {
  return `${remoteRoot}/${compileInto}/browserSystem.js`
}

export const getBrowserSystemLocalURL = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/browserSystem.js`
}

export const compileBrowserSystem = (localURL) => {
  return Promise.resolve()
    .then(() => getBrowserSystemSource())
    .then((result) => compileResultToFileSysten(result, localURL))
}

export const getBrowserPlatformRemoteURL = ({ remoteRoot, compileInto }) => {
  return `${remoteRoot}/${compileInto}/browserPlatform.js`
}

export const getBrowserPlatformLocalURL = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/browserPlatform.js`
}

export const compilePlatform = (localURL) => {
  return Promise.resolve()
    .then(() => compileForBrowser())
    .then((result) => compileResultToFileSysten(result, localURL))
}

export const compilePlatformAndSystem = ({ browserSystemLocalURL, browserPlatformLocalURL }) => {
  return Promise.all([
    compileBrowserSystem(browserSystemLocalURL),
    compilePlatform(browserPlatformLocalURL),
  ])
}
