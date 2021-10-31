if (process.env.AWAIT_FOREVER) {
  await new Promise((resolve) => {
    setTimeout(resolve, 60000)
  })
}
