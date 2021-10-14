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
    enter: async (node, parent) => {
      await urlAndImportMetaUrlVisitor(node, {
        mutations,
        url,
        ressourceBuilder,
        urlAndImportMetaUrls,
      })
      await importAssertionsVisitor(node, {
        parent,
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
    mutation(magicString)
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

  mutations.push((magicString) => {
    magicString.overwrite(
      node.start,
      node.end,
      referenceToCodeForRollup(reference),
    )
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
    parent,
    mutations,
    url,
    resolve,
    jsConcatenation,
    importAssertionsSupport,
    importAssertions,
  },
) => {
  const handleImportAssertion = async ({ node, assert, mutate }) => {
    const { source } = node
    const importSpecifier = source.value

    const urlResolution = await resolve(importSpecifier, url, {
      custom: {
        importAssertionType: assert.type,
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

    if (!jsConcatenation && importAssertionsSupport[assert.type]) {
      // The rollup way to reference an asset is with
      // "import.meta.ROLLUP_FILE_URL_${rollupAssetId}"
      // However it would not work here because
      // It's the static import path that we want to override, not a variable in the script
      console.warn(
        `Due to technical limitations ${url} file will be transformed to js module even if it could be kept as ${assert.type} module`,
      )
    }

    const importedUrlWithoutAssertion = id
    const importedUrlWithAssertion = setUrlSearchParamsDescriptor(id, {
      import_type: assert.type,
    })
    mutations.push((magicString) => {
      mutate({ magicString, importedUrlWithAssertion })
    })
    importAssertions[importedUrlWithAssertion] = {
      importedUrlWithoutAssertion,
      importNode: source,
      type: assert.type,
    }
  }

  if (node.type === "ImportDeclaration") {
    const { assertions = [] } = node
    if (assertions.length === 0) {
      return
    }
    const { type } = getImportAssertionsDescriptor(assertions)
    handleImportAssertion({
      node,
      assert: { type },
      mutate: ({ magicString, importedUrlWithAssertion }) => {
        magicString.overwrite(
          node.source.start,
          node.source.end,
          `"${importedUrlWithAssertion}"`,
        )
      },
    })
    return
  }

  if (node.type === "ObjectExpression" && parent.type === "ImportExpression") {
    // dynamic expression not supported for now
    const { source } = parent
    if (source.type !== "Literal") {
      return
    }

    const { properties } = node
    const assertProperty = properties.find((property) => {
      return property.key.name === "assert"
    })
    if (!assertProperty) {
      return
    }

    const assertProperties = assertProperty.value.properties
    const typeProperty = assertProperties.find((property) => {
      return property.key.name === "type"
    })
    if (!typeProperty) {
      return
    }

    const typePropertyValue = typeProperty.value
    // dynamic type not supported
    if (typePropertyValue.type !== "Literal") {
      return
    }

    // TODO: cela doit mettre une entrée dans l'importmap
    const typeAssertion = typePropertyValue.value
    handleImportAssertion({
      node: parent,
      assert: { type: typeAssertion },
      mutate: ({ magicString, importedUrlWithAssertion }) => {
        magicString.overwrite(
          parent.source.start,
          parent.source.end,
          `"${importedUrlWithAssertion}"`,
        )
        magicString.remove(typeProperty.start, typeProperty.end)
      },
    })
    return
  }
}

const getImportAssertionsDescriptor = (importAssertions) => {
  const assertionAttributes = {}
  importAssertions.forEach((importAssertion) => {
    assertionAttributes[importAssertion.key.name] = importAssertion.value.value
  })
  return assertionAttributes
}
