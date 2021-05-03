import { assertAndNormalizeDirectoryUrl, assertDirectoryPresence } from "@jsenv/util"

export const assertProjectDirectoryUrl = ({ projectDirectoryUrl }) => {
  return assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
}

export const assertProjectDirectoryExists = ({ projectDirectoryUrl }) => {
  assertDirectoryPresence(projectDirectoryUrl)
}
