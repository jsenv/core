// for now node bundle use require
// they may move to systemjs to support top level await

export const importNodeBundle = async ({ bundleFolder, file }) => {
  const namespace = import.meta.require(`${bundleFolder}/${file}`)
  return { namespace }
}
