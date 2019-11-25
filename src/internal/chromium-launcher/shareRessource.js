export const shareRessource = ({ start, stop }) => {
  let useCount = 0
  let ressource

  const startUsing = () => {
    if (useCount === 0) {
      ressource = start()
    }
    useCount++

    const stopUsing = () => {
      useCount--
      if (useCount === 0) {
        const value = ressource
        ressource = undefined
        stop(value)
      }
    }

    return { ressource, stopUsing }
  }

  return { startUsing }
}
