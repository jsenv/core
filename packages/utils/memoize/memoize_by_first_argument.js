export const memoizeByFirstArgument = (compute) => {
  const urlCache = new Map()

  const fnWithMemoization = (url, ...args) => {
    const valueFromCache = urlCache.get(url)
    if (valueFromCache) {
      return valueFromCache
    }
    const value = compute(url, ...args)
    urlCache.set(url, value)
    return value
  }

  fnWithMemoization.forget = () => {
    urlCache.clear()
  }

  return fnWithMemoization
}
