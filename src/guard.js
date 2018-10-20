export const guard = (predicate, fn) => (...args) => {
  if (predicate(...args)) {
    return fn(...args)
  }
  return undefined
}
