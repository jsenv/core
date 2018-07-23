export const guardAsync = (fn, shield) => (...args) => {
  return Promise.resolve(shield(...args)).then(({ shielded }) => {
    if (shielded) {
      return undefined
    }
    return fn(...args)
  })
}

export const guard = guardAsync
