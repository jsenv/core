import { resolveUrl } from "@jsenv/filesystem"

import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { referenceToCodeForRollup } from "./ressource_builder.js"

export const transformImportReferences = async ({
  url,
  code,
  map,
  ast,

  ressourceBuilder,
  jsConcatenation,
  importAssertionsSupport,
  resolve,
}) => {
  const { asyncWalk } = await import("estree-walker")

  const mutations = []
  const urlAndImportMetaUrls = {}
  const importAssertions = {}

  await asyncWalk(ast, {
    enter: async (node) => {
      await urlAndImportMetaUrlVisitor(node, {
        mutations,
        url,
        ressourceBuilder,
        urlAndImportMetaUrls,
      })
      await importAssertionsVisitor(node, {
        mutations,
        url,
        resolve,
        jsConcatenation,
        importAssertionsSupport,
        importAssertions,
      })
    },
  })
  if (mutations.length === 0) {
    return {
      code,
      map,
      urlAndImportMetaUrls,
      importAssertions,
    }
  }

  const { default: MagicString } = await import("magic-string")
  const magicString = new MagicString(code)
  mutations.forEach((mutation) => {
    const { node, value } = mutation()
    magicString.overwrite(node.start, node.end, value)
  })
  code = magicString.toString()
  map = magicString.generateMap({ hires: true })
  return {
    code,
    map,
    urlAndImportMetaUrls,
    importAssertions,
  }
}

const urlAndImportMetaUrlVisitor = async (
  node,
  { mutations, url, ressourceBuilder, urlAndImportMetaUrls },
) => {
  if (!isNewUrlImportMetaUrl(node)) {
    return
  }

  const relativeUrl = node.arguments[0].value
  const ressourceUrl = resolveUrl(relativeUrl, url)
  const reference = await ressourceBuilder.createReferenceFoundInJsModule({
    jsUrl: url,
    ...(node.loc
      ? {
          jsLine: node.loc.start.line,
          jsColumn: node.loc.start.column,
        }
      : {}),
    ressourceSpecifier: ressourceUrl,
  })
  if (!reference) {
    return
  }

  mutations.push(() => {
    return {
      node,
      value: referenceToCodeForRollup(reference),
    }
  })
  urlAndImportMetaUrls[ressourceUrl] = reference
}

const isNewUrlImportMetaUrl = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "URL" &&
    node.arguments.length === 2 &&
    node.arguments[0].type === "Literal" &&
    typeof node.arguments[0].value === "string" &&
    node.arguments[1].type === "MemberExpression" &&
    node.arguments[1].object.type === "MetaProperty" &&
    node.arguments[1].property.type === "Identifier" &&
    node.arguments[1].property.name === "url"
  )
}

const importAssertionsVisitor = async (
  node,
  {
    mutations,
    url,
    resolve,
    jsConcatenation,
    importAssertionsSupport,
    importAssertions,
  },
) => {
  if (node.type !== "ImportDeclaration") {
    return
  }

  const { assertions = [] } = node
  if (assertions.length === 0) {
    return
  }

  const { source } = node
  if (source.type !== "Literal") {
    // dynamic specifier, we'll ignore them for now
    return
  }

  const importSpecifier = source.value
  const { type } = parseImportAssertionsAttributes(assertions)

  const urlResolution = await resolve(importSpecifier, url, {
    custom: {
      importAssertionType: type,
    },
  })
  if (urlResolution === null) {
    return
  }

  const { id, external } =
    typeof urlResolution === "object"
      ? urlResolution
      : { id: urlResolution, external: false }
  if (external) {
    return
  }

  if (!jsConcatenation && importAssertionsSupport[type]) {
    // The rollup way to reference an asset is with
    // "import.meta.ROLLUP_FILE_URL_${rollupAssetId}"
    // However it would not work here because
    // It's the static import path that we want to override, not a variable in the script
    console.warn(
      `Due to technical limitations ${url} file will be transformed to js module even if it could be kept as ${type} module`,
    )
  }

  const importedUrlWithoutAssertion = id
  const importedUrlWithAssertion = setUrlSearchParamsDescriptor(id, {
    import_type: type,
  })
  mutations.push(() => {
    return {
      node: source,
      value: `"${importedUrlWithAssertion}"`,
    }
  })
  importAssertions[importedUrlWithAssertion] = {
    importedUrlWithoutAssertion,
    importNode: source,
    type,
  }
}

const parseImportAssertionsAttributes = (importAssertions) => {
  const assertionAttributes = {}
  importAssertions.forEach((importAssertion) => {
    assertionAttributes[importAssertion.key.name] = importAssertion.value.value
  })
  return assertionAttributes
}
