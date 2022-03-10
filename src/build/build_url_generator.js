import { urlToBasename, urlToExtension, urlToFilename } from "@jsenv/filesystem"

import { generateContentHash } from "./url_versioning.js"

export const createBuildUrlGenerator = ({
  entryPointUrls,
  asOriginalUrl,
  lineBreakNormalization,
}) => {
  const availableNameGenerator = createAvailableNameGenerator()

  const prepareBuildUrlForFile = (file) => {
    const buildRelativeUrlPattern = getBuildRelativeUrlPattern({
      entryPointUrls,
      asOriginalUrl,
      availableNameGenerator,
      file,
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

  const computeBuildRelativeUrl = (file) => {
    const buildRelativeUrl = renderFileNamePattern(
      file.buildRelativeUrlPattern,
      {
        hash: () =>
          generateContentHash(file.bufferAfterBuild, {
            contentType: file.contentType,
            lineBreakNormalization,
          }),
      },
    )
    return buildRelativeUrl
  }

  return { prepareBuildUrlForFile, computeBuildRelativeUrl }
}

const getBuildRelativeUrlPattern = ({
  entryPointUrls,
  asOriginalUrl,
  availableNameGenerator,
  file,
}) => {
  if (file.isEntryPoint) {
    const originalUrl = asOriginalUrl(file.url)
    const entryPointBuildRelativeUrlPattern = entryPointUrls[originalUrl]
    return entryPointBuildRelativeUrlPattern || urlToFilename(originalUrl)
  }

  // inline ressource
  // TODO: should inherit importer directory location because inline
  if (file.isInline) {
    // const importerBuildRelativeUrlWithoutHash =
    //   ressource.importer.buildRelativeUrlWithoutHash
    const name = urlToBasename(file.url)
    const extension = urlToExtension(file.url)
    // no need to ensure name is unique because it's already done
    return `${name}_[hash]${extension}`
  }

  // importmap.
  // the goal is to put the importmap at the same relative path
  // than in the project to avoid having to re-resolve mappings
  if (file.type === "importmap") {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(file.url),
      "/",
    )
    const extension = urlToExtension(file.url)
    return `${name}_[hash]${extension}`
  }

  // service worker:
  // - MUST be at the root (same level than the HTML file)
  //   otherwise it might be registered for the scope "/assets/" instead of "/"
  // - MUST not be versioned
  if (
    file.type === "service_worker_classic" ||
    file.type === "service_worker_module"
  ) {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(file.url),
      "/",
    )
    const extension = urlToExtension(file.url)
    return `${name}${extension}`
  }

  if (file.type === "worker_classic" || file.type === "worker_module") {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(file.url),
      "/",
    )
    const extension = urlToExtension(file.url)
    return `${name}_[hash]${extension}`
  }

  if (file.type === "js_module") {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(file.url),
      "/",
    )
    return `${name}_[hash].js`
  }

  const name = availableNameGenerator.getAvailableNameInDirectory(
    urlToBasename(file.url),
    "assets/",
  )
  const extension = urlToExtension(file.url)
  return file.urlVersioningDisabled
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
