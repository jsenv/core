const relative = await import.meta.resolve("./file.js")
const bare = await import.meta.resolve("foo")

export { relative, bare }
