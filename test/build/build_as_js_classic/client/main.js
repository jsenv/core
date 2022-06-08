const typeofCurrentScript = typeof document.currentScript

window.getResult = async () => {
  const { answer } = await import("./file.js")
  await new Promise((resolve) => {
    setTimeout(resolve, 100)
  })
  const url = import.meta.url
  return {
    typeofCurrentScript,
    answer,
    url,
  }
}
