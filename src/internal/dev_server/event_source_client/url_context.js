export const createUrlContext = () => {
  const { pathname, search } = new URL(window.location)
  const ressource = `${pathname}${search}`
  const slashIndex = ressource.indexOf("/", 1)
  const compileDirectoryRelativeUrl = ressource.slice(1, slashIndex)
  const afterCompileDirectory = ressource.slice(slashIndex)
  const nextSlashIndex = afterCompileDirectory.indexOf("/")
  const compileId = afterCompileDirectory.slice(0, nextSlashIndex)
  // const afterCompileId = afterCompileDirectory.slice(nextSlashIndex)

  return {
    // if we are using source files (todo: find how to detect that)
    // then we would return `${window.location.origin}${relativeUrl}`
    asUrlToFetch: (relativeUrl) => {
      const origin = window.location.origin
      return `${origin}/${compileDirectoryRelativeUrl}${compileId}/${relativeUrl}`
    },
  }
}
