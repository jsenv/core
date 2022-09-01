import { createMagicSource } from "@jsenv/sourcemap"

export const replacePlaceholders = (content, replacements) => {
  const magicSource = createMagicSource(content)
  Object.keys(replacements).forEach((key) => {
    let index = content.indexOf(key)
    while (index !== -1) {
      const start = index
      const end = index + key.length
      magicSource.replace({ start, end, replacement: replacements[key] })
      index = content.indexOf(key, end)
    }
  })
  return magicSource.toContentAndSourcemap()
}
