import { resolveUrl } from "@jsenv/filesystem"

import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { referenceToCodeForRollup } from "./ressource_builder.js"

export const transformImportReferences = async ({
  url,
  code,
  ast,

  ressourceBuilder,
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
    magicString.overwrite(
      mutation.node.start,
      mutation.node.end,
      mutation.value,
    )
  })
  const codeOutput = magicString.toString()
  const map = magicString.generateMap({ hires: true })
  return {
    code: codeOutput,
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
  { mutations, url, resolve, importAssertions },
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
  const urlResolution = await resolve(importSpecifier, url, {
    skipUrlImportTrace: true,
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

  const { type } = parseImportAssertionsAttributes(assertions)
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
  }
}

const parseImportAssertionsAttributes = (importAssertions) => {
  const assertionAttributes = {}
  importAssertions.forEach((importAssertion) => {
    assertionAttributes[importAssertion.key.name] = importAssertion.value.value
  })
  return assertionAttributes
}
