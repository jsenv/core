process.on("message", async ({ url, awaitNamespace }) => {
  try {
    const namespace = await import(url)
    if (!awaitNamespace) {
      process.send({ namespace })
      return
    }

    const namespaceAwaited = {}
    await Promise.all(
      Object.keys(namespace).map(async (key) => {
        namespaceAwaited[key] = await namespace[key]
      }),
    )
    process.send({ namespace: namespaceAwaited })
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
