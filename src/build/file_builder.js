import { createBuildUrlGenerator } from "./build_url_generator.js"

export const createFileBuilder = () => {
  const buildUrlGenerator = createBuildUrlGenerator()
  const files = {}

  const createReference = ({
    label,
    urlSite,
    url,

    contentTypeExpected,
    crossorigin,
    integrity,

    isPlaceholder,
    isRessourceHint,
    isImportAssertion,
    isEntryPoint,
    urlVersioningDisabled,

    contentType,
    bufferBeforeBuild,
  }) => {
    const existingFile = files[url]
    let file
    if (existingFile) {
      file = existingFile
    } else {
      file = createFile({
        contentType,
        url,
        bufferBeforeBuild,

        isEntryPoint,
        isPlaceholder,
        urlVersioningDisabled,
      })
      files[url] = file
    }
    const reference = {
      label,
      urlSite,
      isRessourceHint,
      isImportAssertion,
      contentTypeExpected,
      crossorigin,
      integrity,
    }
    reference.file = file
    file.references.push(reference)
    return reference
  }

  const createFile = ({
    contentType,
    url,
    bufferBeforeBuild,

    isEntryPoint,
    isPlaceholder,
    urlVersioningDisabled,
  }) => {
    const file = {
      contentType,
      url,
      bufferBeforeBuild,
      bufferAfterBuild: undefined,
      firstStrongReference: null,
      references: [],

      isEntryPoint,
      isPlaceholder,
      urlVersioningDisabled,
    }
    const { buildRelativeUrlPattern, buildRelativeUrlWithoutHash } =
      buildUrlGenerator.prepareBuildUrlForFile(file)
    file.buildRelativeUrlPattern = buildRelativeUrlPattern
    file.buildRelativeUrlWithoutHash = buildRelativeUrlWithoutHash
    return file
  }

  const createReferenceFoundInJsModule = ({ label, urlSite, url }) => {
    const reference = createReference({
      label,
      urlSite,
      url,
    })
    return reference
  }

  return {
    createReferenceFoundInJsModule,
  }
}
