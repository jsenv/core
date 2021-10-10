import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"

export const transformImportAssertions = async ({
  code,
  url,
  ast,
  resolve,
}) => {
  const { default: MagicString } = await import("magic-string")
  const { asyncWalk } = await import("estree-walker")

  const magicString = new MagicString(code)
  const importAssertions = {}

  await asyncWalk(ast, {
    enter: async (node) => {
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
      magicString.overwrite(
        source.start,
        source.end,
        `"${importedUrlWithAssertion}"`,
      )
      importAssertions[importedUrlWithAssertion] = {
        importedUrlWithoutAssertion,
        importNode: source,
      }
    },
  })

  const codeOutput = magicString.toString()
  const map = magicString.generateMap({ hires: true })
  return {
    code: codeOutput,
    map,
    importAssertions,
  }
}

const parseImportAssertionsAttributes = (importAssertions) => {
  const assertionAttributes = {}
  importAssertions.forEach((importAssertion) => {
    assertionAttributes[importAssertion.key.name] = importAssertion.value.value
  })
  return assertionAttributes
}
