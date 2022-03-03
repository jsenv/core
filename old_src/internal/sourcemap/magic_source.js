import { urlToFileSystemPath } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"

export const createMagicSource = ({ url, content, map }) => {
  const filename = urlToFileSystemPath(url)
  const {
    OriginalSource,
    SourceMapSource,
    ConcatSource,
    ReplaceSource,
  } = require("webpack-sources")

  let firstSource
  if (map) {
    firstSource = new SourceMapSource(content, filename, map)
  } else {
    firstSource = new OriginalSource(content, filename)
  }
  const mutations = []
  return {
    prepend: (string) => {
      mutations.push((source) => {
        const concatSource = new ConcatSource(string, source)
        return concatSource
      })
    },
    append: (string) => {
      mutations.push((source) => {
        const concatSource = new ConcatSource(source, string)
        return concatSource
      })
    },
    replace: ({ start, end, replacement }) => {
      mutations.push((source) => {
        const replaceSource = new ReplaceSource(source)
        replaceSource.replace(start, end, replacement)
        return replaceSource
      })
    },
    insert: ({ position, insertion }) => {
      mutations.push((source) => {
        const replaceSource = new ReplaceSource(source)
        replaceSource.insert(position, insertion)
        return replaceSource
      })
    },
    toStringAndMap: (options) => {
      const lastSource = mutations.reduce((previous, mutation) => {
        return mutation(previous)
      }, firstSource)
      const { source, map } = lastSource.sourceAndMap(options)
      return {
        code: source,
        map,
      }
    },
  }
}
