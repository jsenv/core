import { urlToBasename, urlToExtension, urlToFilename } from "@jsenv/filesystem"

import { generateContentHash } from "@jsenv/core/src/utils/url_versioning.js"

export const createBuildUrlGenerator = ({
  entryPointUrls,
  lineBreakNormalization,
}) => {
  const availableNameGenerator = createAvailableNameGenerator()

  const prepareBuildUrlForFile = (file) => {
    const buildRelativeUrlPattern = getBuildRelativeUrlPattern({
      entryPointUrls,
      availableNameGenerator,
      file,
    })
    const buildRelativeUrlWithoutHash = buildRelativeUrlPattern.replace(
      "?v=[hash]",
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
  availableNameGenerator,
  file,
}) => {
  if (file.isEntryPoint) {
    const entryPointBuildRelativeUrlPattern = entryPointUrls[file.url]
    return entryPointBuildRelativeUrlPattern || urlToFilename(file.url)
  }

  // inline ressource
  // TODO: should inherit importer directory location because inline
  if (file.isInline) {
    // const importerBuildRelativeUrlWithoutHash =
    //   ressource.importer.buildRelativeUrlWithoutHash
    const name = urlToBasename(file.url)
    const extension = urlToExtension(file.url)
    // no need to ensure name is unique because it's already done
    return `${name}${extension}?v=[hash]`
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
    return `${name}${extension}?v=[hash]`
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
    return `${name}${extension}?v=[hash]`
  }

  if (file.type === "js_module") {
    const name = availableNameGenerator.getAvailableNameInDirectory(
      urlToBasename(file.url),
      "/",
    )
    return `${name}.js?v=[hash]`
  }

  const name = availableNameGenerator.getAvailableNameInDirectory(
    urlToBasename(file.url),
    "assets/",
  )
  const extension = urlToExtension(file.url)
  return file.urlVersioningDisabled
    ? `assets/${name}${extension}`
    : `assets/${name}${extension}?v=[hash]`
}

export const createAvailableNameGenerator = () => {
  const cache = {}
  const getAvailableNameInNamespace = (name, namespace) => {
    let names = cache[namespace]
    if (!names) {
      names = []
      cache[namespace] = names
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

  const generateFileName = (name) => {
    return getAvailableNameInNamespace(name, "dist")
  }

  const generateAssetName = (name) => {
    return getAvailableNameInNamespace(name, "asset")
  }

  return {
    generateFileName,
    generateAssetName,
  }
}

const renderFileNamePattern = (pattern, replacements) => {
  return pattern.replace(/\[(\w+)\]/g, (_match, type) => {
    const replacement = replacements[type](_match)
    return replacement
  })
}
