import { filePathToUrl, hasScheme, ensureUrlTrailingSlash } from "./urlUtils.js"
import { assertDirectoryExists } from "./filesystemUtils.js"

export const assertProjectDirectoryUrl = ({ projectDirectoryUrl }) => {
  if (projectDirectoryUrl instanceof URL) {
    projectDirectoryUrl = projectDirectoryUrl.href
  }

  if (typeof projectDirectoryUrl === "string") {
    const url = hasScheme(projectDirectoryUrl)
      ? projectDirectoryUrl
      : filePathToUrl(projectDirectoryUrl)

    if (!url.startsWith("file://")) {
      throw new Error(
        `projectDirectoryUrl must starts with file://, received ${projectDirectoryUrl}`,
      )
    }

    return ensureUrlTrailingSlash(url)
  }

  throw new TypeError(
    `projectDirectoryUrl must be a string or an url, received ${projectDirectoryUrl}`,
  )
}

export const assertProjectDirectoryExists = ({ projectDirectoryUrl }) => {
  assertDirectoryExists(projectDirectoryUrl)
}

export const assertImportMapFileRelativeUrl = ({ importMapFileRelativeUrl }) => {
  if (typeof importMapFileRelativeUrl !== "string") {
    throw new TypeError(
      `importMapFileRelativeUrl must be a string, received ${importMapFileRelativeUrl}`,
    )
  }
}

export const assertImportMapFileInsideProject = ({ importMapFileUrl, projectDirectoryUrl }) => {
  if (!importMapFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`importmap file must be inside project directory
--- import map file url ---
${importMapFileUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
}
