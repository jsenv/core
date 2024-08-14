import { existsSync } from "node:fs"

export const detectBrowser = (pathCandidates) => {
  return pathCandidates.some((pathCandidate) => {
    return existsSync(pathCandidate)
  })
}
