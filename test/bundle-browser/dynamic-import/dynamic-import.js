const loadFeature = async () => {
  const { answer } = await import("./answer.js")
  return answer
}

export default loadFeature()
