// for now node bundle use require
// they may move to systemjs to support top level await

export const importNodeBundle = ({ bundleFolder, file }) => {
  return import.meta.require(`${bundleFolder}/${file}.js`)
}
