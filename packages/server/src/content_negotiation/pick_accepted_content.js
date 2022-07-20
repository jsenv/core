export const pickAcceptedContent = ({
  availables,
  accepteds,
  getAcceptanceScore,
}) => {
  let highestScore = -1
  let availableWithHighestScore = null
  let availableIndex = 0
  while (availableIndex < availables.length) {
    const available = availables[availableIndex]
    availableIndex++

    let acceptedIndex = 0
    while (acceptedIndex < accepteds.length) {
      const accepted = accepteds[acceptedIndex]
      acceptedIndex++

      const score = getAcceptanceScore(accepted, available)
      if (score > highestScore) {
        availableWithHighestScore = available
        highestScore = score
      }
    }
  }
  return availableWithHighestScore
}
