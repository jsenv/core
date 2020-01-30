export const memoize = (compute) => {
  let memoized = false
  let memoizedValue

  const fnWithMemoization = (...args) => {
    if (memoized) {
      return memoizedValue
    }
    // if compute is recursive wait for it to be fully done before storing the lockValue
    // so set locked later
    memoizedValue = compute(...args)
    memoized = true
    return memoizedValue
  }

  fnWithMemoization.forget = () => {
    const value = memoizedValue
    memoized = false
    memoizedValue = undefined
    return value
  }

  return fnWithMemoization
}
