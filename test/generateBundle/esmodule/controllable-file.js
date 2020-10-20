process.on("message", async ({ url, namespaceProperty }) => {
  try {
    const namespace = await import(url)
    const value = await namespace[namespaceProperty]
    process.send({ value })
  } catch (error) {
    process.send({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
  }
})

setTimeout(() => {
  process.send("ready")
})
