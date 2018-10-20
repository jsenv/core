import { getPlatformNameAndVersionFromUserAgent } from "./getPlatformNameAndVersionFromUserAgent.js"
import { platformToCompileId } from "../platformToCompileId.js"

/* eslint-disable no-undef, no-use-before-define */
export const REMOTE_ROOT = REMOTE_ROOT

const COMPILE_INTO = COMPILE_INTO

export const COMPAT_MAP = COMPAT_MAP

export const COMPAT_MAP_DEFAULT_ID = COMPAT_MAP_DEFAULT_ID

export const HOTRELOAD = HOTRELOAD

export const HOTRELOAD_SSE_ROOT = HOTRELOAD_SSE_ROOT

export const FILE = FILE
/* eslint-enable no-undef, no-use-before-define  */

const { platformName, platformVersion } = getPlatformNameAndVersionFromUserAgent(
  window.navigator.userAgent,
)

export const COMPILE_ID = platformToCompileId({
  compatMap: COMPAT_MAP,
  defaultId: COMPAT_MAP_DEFAULT_ID,
  platformName,
  platformVersion,
})

export const COMPILE_ROOT = `${COMPILE_INTO}/${COMPILE_ID}`

export const fileToRemoteCompiledFile = (file) => `${COMPILE_ROOT}/${file}`

export const fileToRemoteSourceFile = (file) => `${REMOTE_ROOT}/${file}`

export const isRemoteCompiledFile = (string) => string.startsWith(COMPILE_ROOT)

export const remoteCompiledFileToFile = (remoteCompiledFile) =>
  remoteCompiledFile.slice(COMPILE_ROOT.length)
