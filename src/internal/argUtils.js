import {
  assertAndNormalizeDirectoryUrl,
  assertDirectoryPresence,
} from "@jsenv/filesystem"

export const assertProjectDirectoryUrl = ({ projectDirectoryUrl }) => {
  return assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
}

export const assertProjectDirectoryExists = ({ projectDirectoryUrl }) => {
  assertDirectoryPresence(projectDirectoryUrl)
}
