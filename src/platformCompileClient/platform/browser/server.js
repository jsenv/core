import { getPlatformNameAndVersionFromUserAgent } from "./getPlatformNameAndVersionFromUserAgent.js"
import { platformToCompileId } from "../platformToCompileId.js"

/* eslint-disable no-undef */
export const SOURCE_ROOT = SERVER_SOURCE_ROOT

const COMPILE_ORIGIN = SERVER_COMPILE_ORIGIN

const COMPILE_INTO = SERVER_COMPILE_INTO

export const COMPAT_MAP = SERVER_COMPAT_MAP

export const COMPAT_MAP_DEFAULT_ID = SERVER_COMPAT_MAP_DEFAULT_ID

export const HOTRELOAD = SERVER_HOTRELOAD

export const HOTRELOAD_SSE_ROOT = SERVER_HOTRELOAD_SSE_ROOT

export const FILE = SERVER_FILE
/* eslint-enable no-undef */

const { platformName, platformVersion } = getPlatformNameAndVersionFromUserAgent(
  window.navigator.userAgent,
)

export const COMPILE_ID = platformToCompileId({
  compatMap: COMPAT_MAP,
  defaultId: COMPAT_MAP_DEFAULT_ID,
  platformName,
  platformVersion,
})

export const COMPILE_ROOT = `${COMPILE_ORIGIN}/${COMPILE_INTO}/${COMPILE_ID}`

export const fileToRemoteCompiledFile = (file) => `${COMPILE_ROOT}/${file}`

export const fileToRemoteSourceFile = (file) => `${SOURCE_ROOT}/${file}`

export const isRemoteCompiledFile = (string) => string.startsWith(COMPILE_ROOT)

export const remoteCompiledFileToFile = (remoteCompiledFile) =>
  remoteCompiledFile.slice(COMPILE_ROOT.length)
