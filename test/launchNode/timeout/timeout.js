// https://github.com/nodejs/node/issues/22088
console.log("foo")
await new Promise((resolve) => {
  const id = setTimeout(resolve, 30000)
  process.on("SIGINT", () => {
    clearTimeout(id)
  })
})
