import { WELL_KNOWN_SYSTEM_PATHNAME } from "../compile-server/system-service/index.js"

const WELL_KNOWN_BROWSER_SCRIPT_PATHNAME = "/.jsenv-well-known/browser-script.js"

export const redirectBrowserScriptToSystem = ({ compileServerOrigin, request: { ressource } }) => {
  if (ressource !== WELL_KNOWN_BROWSER_SCRIPT_PATHNAME) return null

  // launch chromium will do his stuff
  return {
    status: 307,
    headers: {
      location: `${compileServerOrigin}${WELL_KNOWN_SYSTEM_PATHNAME}`,
    },
  }
}
