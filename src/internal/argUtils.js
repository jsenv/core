import { assertDirectoryExists } from "./filesystemUtils.js"

export const assertProjectDirectoryPath = ({ projectDirectoryPath }) => {
  if (typeof projectDirectoryPath !== "string") {
    throw new TypeError(`projectDirectoryPath must be a string, received ${projectDirectoryPath}`)
  }
}

export const assertProjectDirectoryExists = ({ projectDirectoryUrl }) => {
  assertDirectoryExists(projectDirectoryUrl)
}

export const assertImportMapFileRelativePath = ({ importMapFileRelativeUrl }) => {
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

export const assertCompileDirectoryRelativePath = ({ compileDirectoryRelativeUrl }) => {
  if (typeof compileDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `compileDirectoryRelativeUrl must be a string, received ${compileDirectoryRelativeUrl}`,
    )
  }
}

export const assertCompileDirectoryInsideProject = ({
  compileDirectoryUrl,
  projectDirectoryUrl,
}) => {
  if (!compileDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`compile directory must be inside project directory
--- compile directory url ---
${compileDirectoryUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
}
