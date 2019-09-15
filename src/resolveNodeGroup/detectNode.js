export const detectNode = () => {
  return { name: "node", version: process.version.slice(1) }
}
