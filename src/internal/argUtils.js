import { assertDirectoryExists } from "./filesystemUtils.js"

export const assertProjectDirectoryPath = ({ projectDirectoryPath }) => {
  if (typeof projectDirectoryPath !== "string") {
    throw new TypeError(`projectDirectoryPath must be a string, received ${projectDirectoryPath}`)
  }
}

export const assertProjectDirectoryExists = ({ projectDirectoryUrl }) => {
  assertDirectoryExists(projectDirectoryUrl)
}

export const assertImportMapFileRelativePath = ({ importMapFileRelativePath }) => {
  if (typeof importMapFileRelativePath !== "string") {
    throw new TypeError(
      `importMapFileRelativePath must be a string, received ${importMapFileRelativePath}`,
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

export const assertCompileDirectoryRelativePath = ({ compileDirectoryRelativePath }) => {
  if (typeof compileDirectoryRelativePath !== "string") {
    throw new TypeError(
      `compileDirectoryRelativePath must be a string, received ${compileDirectoryRelativePath}`,
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
