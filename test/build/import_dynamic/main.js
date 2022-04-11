export const loadFeature = async () => {
  const { answer } = await import("./feature/feature.js")
  // eslint-disable-next-line no-debugger
  debugger
  console.log(answer)
}
