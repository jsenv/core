console.log("close in 2s")

// should keep process alive for 2s but then it should naturally exits
const timeout = setTimeout(() => {}, 2000)

process.on("SIGTERM", () => {
  clearTimeout(timeout)
})
