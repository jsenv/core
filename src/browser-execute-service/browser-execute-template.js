export const execute = async ({ compileServerOrigin, compileInto, filenameRelative }) => {
  const { executeCompiledFile } = await window.System.import(
    "/.jsenv-well-known/browser-platform.js",
  )

  return executeCompiledFile({
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
}
