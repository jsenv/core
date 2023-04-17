window.ask = async () => {
  const { answer } = await import("./dep.js")
  return answer
}
