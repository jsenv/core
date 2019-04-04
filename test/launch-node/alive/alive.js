export const output = Promise.resolve(42)

console.log("stay alive")

const id = setInterval(() => {
  console.log("alive")
}, 1000 * 5)

process.on("SIGINT", () => {
  clearInterval(id)
})
