export const output = Promise.resolve(42)

console.log("close in 5s")

const id = setTimeout(() => {
  console.log("will close")
}, 1000 * 5)

process.on("SIGTERM", () => {
  clearTimeout(id)
})
