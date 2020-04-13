import { assertAndNormalizeDirectoryUrl, assertDirectoryPresence, urlIsInsideOf } from "@jsenv/util"

export const assertProjectDirectoryUrl = ({ projectDirectoryUrl }) => {
  return assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
}

export const assertProjectDirectoryExists = ({ projectDirectoryUrl }) => {
  assertDirectoryPresence(projectDirectoryUrl)
}

export const assertImportMapFileRelativeUrl = ({ importMapFileRelativeUrl }) => {
  if (importMapFileRelativeUrl === "") {
    throw new TypeError(`importMapFileRelativeUrl is an empty string`)
  }
  if (typeof importMapFileRelativeUrl !== "string") {
    throw new TypeError(
      `importMapFileRelativeUrl must be a string, received ${importMapFileRelativeUrl}`,
    )
  }
}

export const assertImportMapFileInsideProject = ({ importMapFileUrl, projectDirectoryUrl }) => {
  if (!urlIsInsideOf(importMapFileUrl, projectDirectoryUrl)) {
    throw new Error(`importmap file must be inside project directory
--- import map file url ---
${importMapFileUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
}
