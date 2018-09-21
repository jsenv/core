export const guardAsync = (fn, shield) => (...args) => {
  return Promise.resolve()
    .then(() => shield(...args))
    .then((shielded) => (shielded ? undefined : fn(...args)))
}

export const guard = guardAsync
