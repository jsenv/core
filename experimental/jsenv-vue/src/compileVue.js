import { createRequire } from "module"

import { urlToRelativeUrl, resolveUrl } from "@jsenv/filesystem"

import { transformResultToCompilationResult } from "@jsenv/core/src/internal/compiling/transformResultToCompilationResult.js"

const require = createRequire(import.meta.url)

// eslint-disable-next-line import/no-unresolved
const VueComponentCompiler = require("@vue/component-compiler")

const VueCompiler = VueComponentCompiler.createDefaultCompiler()

export const compileVue = async ({
  code,
  url,
  compiledUrl,
  projectDirectoryUrl,

  sourcemapExcludeSources,
}) => {
  const vueComponent = VueCompiler.compileToDescriptor(url, code, "utf8")
  const assembledComponent = VueComponentCompiler.assemble(
    vueComponent,
    url,
    vueComponent,
  )
  const mapAfterVueCompilation = assembledComponent.map
  const sourcemapFileUrl = `${compiledUrl}.map`
  mapAfterVueCompilation.sources = mapAfterVueCompilation.sources.map(
    (source) => {
      const sourceUrl = resolveUrl(source, sourcemapFileUrl)
      return urlToRelativeUrl(sourceUrl, sourcemapFileUrl)
    },
  )

  return transformResultToCompilationResult(
    {
      contentType: "application/javascript",
      code: assembledComponent.code,
      map: assembledComponent.map,
    },
    {
      projectDirectoryUrl,
      originalFileContent: code,
      originalFileUrl: url,
      compiledFileUrl: compiledUrl,
      sourcemapFileUrl,
      sourcemapExcludeSources,
    },
  )
}
