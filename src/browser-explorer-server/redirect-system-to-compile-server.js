import { WELL_KNOWN_SYSTEM_PATHNAME } from "../compile-server/system-service/index.js"

export const redirectSystemToCompileServer = ({ compileServerOrigin, request: { ressource } }) => {
  if (ressource !== WELL_KNOWN_SYSTEM_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${compileServerOrigin}${ressource}`,
    },
  }
}
