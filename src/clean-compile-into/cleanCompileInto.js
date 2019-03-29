// because compileInto mirror files
// it can contain files that no longer exists.
// this function is responsible to clean these files.
// for now it just removes completely the compileInfo folder.
// next iteration will check if a file inside compileInto still exists
// and remove only useless files
const rimraf = import.meta.require("rimraf")

export const cleanCompileInto = ({
  // cancellationToken,
  localRoot,
  compileInto,
}) => {
  return new Promise((resolve, reject) => {
    rimraf(`${localRoot}/${compileInto}`, { glob: false }, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
