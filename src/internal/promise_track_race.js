export const promiseTrackRace = (promiseArray) => {
  return new Promise((resolve, reject) => {
    let resolved = false

    const visit = (index) => {
      const promise = promiseArray[index]
      promise.then((value) => {
        if (resolved) return
        resolved = true
        resolve({ winner: promise, value, index })
      }, reject)
    }

    let i = 0
    while (i < promiseArray.length) {
      visit(i++)
    }
  })
}
