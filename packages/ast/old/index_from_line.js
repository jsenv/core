export const createIndexFromLine = (content) => {
  const lines = content.split(/\r?\n/)
  const indexFromLine = (line) => {
    if (line === 0) return 0
    let index = 0
    let i = 0
    let j = line
    while (i < j) {
      index += Buffer.byteLength(lines[i])
      i++
    }
    return index
  }
  return indexFromLine
}
