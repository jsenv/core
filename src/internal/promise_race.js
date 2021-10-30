export const racePromises = (promiseArray) => {
  return new Promise((resolve, reject) => {
    let resolved = false

    const visit = (index) => {
      const promise = promiseArray[index]
      promise.then(() => {
        if (resolved) return
        resolved = true
        resolve(promise)
      }, reject)
    }

    let i = 0
    while (i < promiseArray.length) {
      visit(i++)
    }
  })
}
