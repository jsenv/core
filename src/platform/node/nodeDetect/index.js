export const detect = () => {
  return { name: "node", version: process.version.slice(1) }
}
