import { compileBrowserPlatform } from "./compileBrowserPlatform.js"
import { compileBrowserSystemImporter } from "./compileBrowserSystemImporter.js"
import { compileCompileMap } from "./compileCompileMap.js"

export const getBrowserPlatformRemoteURL = ({ remoteRoot, compileInto }) => {
  return `${remoteRoot}/${compileInto}/browserPlatform.js`
}

export const getBrowserPlatformLocalURL = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/browserPlatform.js`
}

export const getCompileMapLocalURL = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/compileMap.json`
}

export const getCompileMapRemoteURL = ({ remoteRoot, compileInto }) => {
  return `${remoteRoot}/${compileInto}/compileMap.json`
}

export const compileProject = async ({ localRoot, compileInto }) => {
  const compilePlatform = async () => {
    const compileMap = await compileCompileMap({ localRoot, compileInto })
    return compileBrowserPlatform({ compileMap, localRoot, compileInto })
  }

  return Promise.all([compilePlatform(), compileBrowserSystemImporter({ localRoot, compileInto })])
}
