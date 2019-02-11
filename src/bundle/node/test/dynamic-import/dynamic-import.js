const loadFeature = async () => {
  const { answer } = await import("./answer.js")
  console.log(answer)
}

loadFeature()
