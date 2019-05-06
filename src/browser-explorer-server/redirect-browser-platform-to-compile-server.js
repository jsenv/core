import { WELL_KNOWN_BROWSER_PLATFORM_PATHNAME } from "../browser-platform-service/index.js"

export const redirectBrowserPlatformToCompileServer = ({
  compileServerOrigin,
  request: { ressource },
}) => {
  if (ressource !== WELL_KNOWN_BROWSER_PLATFORM_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${compileServerOrigin}${ressource}`,
    },
  }
}
