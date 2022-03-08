import MagicString from "magic-string"

export const createMagicSource = ({ url, content }) => {
  if (content === undefined) {
    throw new Error("content missing")
  }
  const mutations = []
  return {
    prepend: (string) => {
      mutations.push((magicString) => {
        magicString.prepend(string)
      })
    },
    append: (string) => {
      mutations.push((magicString) => {
        magicString.append(string)
      })
    },
    replace: ({ start, end, replacement }) => {
      mutations.push((magicString) => {
        magicString.overwrite(start, end, replacement)
      })
    },
    remove: ({ start, end }) => {
      mutations.push((magicString) => {
        magicString.remove(start, end)
      })
    },
    toContentAndSourcemap: () => {
      const magicString = new MagicString(content)
      mutations.forEach((mutation) => {
        mutation(magicString)
      })
      const code = magicString.toString()
      const map = magicString.generateMap({ hires: true })
      // should we do map.file = urlToFilename(urlFacade) OR map.file = urlToFilename(url)
      map.sources = [url]
      map.sourcesContent = [content]
      return {
        content: code,
        sourcemap: map,
      }
    },
  }
}
