import { WELL_KNOWN_SYSTEM_PATHNAME } from "../system-service/index.js"

export const redirectSystemToCompileServer = ({ compileServerOrigin, ressource }) => {
  if (ressource !== WELL_KNOWN_SYSTEM_PATHNAME) return null

  return {
    status: 307,
    headers: {
      location: `${compileServerOrigin}${ressource}`,
    },
  }
}
