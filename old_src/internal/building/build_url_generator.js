import { urlToBasename, urlToExtension, urlToFilename } from "@jsenv/filesystem"

import { generateContentHash } from "./url_versioning/url_versioning.js"

export const createBuildUrlGenerator = ({
  entryPointUrls,
  asOriginalUrl,
  lineBreakNormalization,
}) => {
  const availableNameGenerator = createAvailableNameGenerator()

  const prepareBuildUrlForRessource = (ressource) => {
    const buildRelativeUrlPattern = getBuildRelativeUrlPattern({
      entryPointUrls,
      asOriginalUrl,
      availableNameGenerator,
      ressource,
    })
    const buildRelativeUrlWithoutHash = buildRelativeUrlPattern.replace(
      "_[hash]",
      "",
    )
    return {
      buildRelativeUrlPattern,
      buildRelativeUrlWithoutHash,
    }
  }

  const computeBuildRelativeUrl = (ressource) => {
    const buildRelativeUrl = renderFileNamePattern(
      ressource.buildRelativeUrlPattern,
      {
        hash: () =>
          generateContentHash(ressource.bufferAfterBuild, {
            contentType: ressource.contentType,
            lineBreakNormalization,
          }),
      },
    )
    return buildRelativeUrl
  }

  return { prepareBuildUrlForRessource, computeBuildRelativeUrl }
}

const getBuildRelativeUrlPattern = ({
  entryPointUrls,
  asOriginalUrl,
  availableNameGenerator,
  ressource,
}) => {
  if (ressource.isEntryPoint) {
    const originalUrl = asOriginalUrl(ressource.url)
    const entryPointBuildRelativeUrlPattern = entryPointUrls[originalUrl]
    return entryPointBuildRelativeUrlPattern || urlToFilename(originalUrl)
  }

  // inline ressource
  // TODO: should inherit importer directory location because inline
  if (ressource.isInline) {
    // const importerBuildRelativeUrlWithoutHash =
    //   ressource.importer.buildRelativeUrlWithoutHash
    const name = urlToBasename(ressource.url)
    const extension = urlToExtension(ressource.url)
    // no need to ensure name is unique because it's already done
    return `${name}_[hash]${extension}`
  }

  // importmap.
  // the goal is to put the importmap at the same relative path
  // than in the project to avoid having to re-resolve mappings
  if (ressource.contentType === "application/importmap+json") {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(ressource.url),
      "/",
    )
    const extension = urlToExtension(ressource.url)
    return `${name}_[hash]${extension}`
  }

  // service worker:
  // - MUST be at the root (same level than the HTML file)
  //   otherwise it might be registered for the scope "/assets/" instead of "/"
  // - MUST not be versioned
  if (ressource.isServiceWorker) {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(ressource.url),
      "/",
    )
    const extension = urlToExtension(ressource.url)
    return `${name}${extension}`
  }

  if (ressource.isWorker) {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(ressource.url),
      "/",
    )
    const extension = urlToExtension(ressource.url)
    return `${name}_[hash]${extension}`
  }

  if (ressource.isJsModule) {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(ressource.url),
      "/",
    )
    return `${name}_[hash].js`
  }

  const name = availableNameGenerator.getAvailableNameInDirectory(
    urlToBasename(ressource.url),
    "assets/",
  )
  const extension = urlToExtension(ressource.url)
  return ressource.urlVersioningDisabled
    ? `assets/${name}${extension}`
    : `assets/${name}_[hash]${extension}`
}

const createAvailableNameGenerator = () => {
  const cache = {}
  const getAvailableNameInDirectory = (name, directory) => {
    let names = cache[directory]
    if (!names) {
      names = []
      cache[directory] = names
    }

    let nameCandidate = name
    let integer = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!names.includes(nameCandidate)) {
        names.push(nameCandidate)
        return nameCandidate
      }
      integer++
      nameCandidate = `${name}${integer}`
    }
  }

  return {
    getAvailableNameInDirectory,
  }
}

const renderFileNamePattern = (pattern, replacements) => {
  return pattern.replace(/\[(\w+)\]/g, (_match, type) => {
    const replacement = replacements[type](_match)
    return replacement
  })
}
