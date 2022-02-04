export const createUrlContext = () => {
  const { origin, pathname, search } = new URL(window.location)
  if (!pathname.includes("/.jsenv/")) {
    return {
      asUrlToFetch: (relativeUrl) => {
        return `${origin}/${relativeUrl}`
      },
    }
  }
  const ressource = `${pathname}${search}`
  const slashIndex = ressource.indexOf("/", 1)
  const compileDirectoryRelativeUrl = ressource.slice(1, slashIndex)
  const afterCompileDirectory = ressource.slice(slashIndex + 1)
  const nextSlashIndex = afterCompileDirectory.indexOf("/")
  const compileId = afterCompileDirectory.slice(0, nextSlashIndex)
  return {
    asUrlToFetch: (relativeUrl) => {
      return `${origin}/${compileDirectoryRelativeUrl}/${compileId}/${relativeUrl}`
    },
  }
}
