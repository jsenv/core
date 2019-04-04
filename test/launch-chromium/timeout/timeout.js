console.log("foo")
await new Promise((resolve) => {
  setTimeout(resolve, 10000)
})
