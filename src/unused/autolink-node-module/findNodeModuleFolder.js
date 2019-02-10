import resolveNodeModuleIndexFile from "resolve"

export const findNodeModuleFolder = async ({ moduleName, basedir }) => {
  const indexFile = await findNodeModuleIndexFile({ moduleName, basedir })

  const lastIndex = indexFile.lastIndexOf("node_modules/")
  const before = indexFile.slice(0, lastIndex - 1)
  const after = indexFile.slice(lastIndex + "node_modules/".length)
  const afterSlashIndex = after.indexOf("/")
  const folderName = after.slice(0, afterSlashIndex)
  return `${before}/node_modules/${folderName}`
}

const findNodeModuleIndexFile = ({ moduleName, basedir }) =>
  new Promise((resolve, reject) => {
    resolveNodeModuleIndexFile(moduleName, { basedir }, (error, value) => {
      if (error) {
        reject(error)
      } else {
        resolve(value)
      }
    })
  })
