import { assertDirectoryExists } from "./filesystemUtils.js"

export const assertProjectDirectoryPath = ({ projectDirectoryPath }) => {
  if (typeof projectDirectoryPath !== "string") {
    throw new TypeError(`projectDirectoryPath must be a string, received ${projectDirectoryPath}`)
  }
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
