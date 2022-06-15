export const statsToType = (stats) => {
  if (stats.isFile()) return "file"
  if (stats.isDirectory()) return "directory"
  if (stats.isSymbolicLink()) return "symbolic-link"
  if (stats.isFIFO()) return "fifo"
  if (stats.isSocket()) return "socket"
  if (stats.isCharacterDevice()) return "character-device"
  if (stats.isBlockDevice()) return "block-device"
  return undefined
}
