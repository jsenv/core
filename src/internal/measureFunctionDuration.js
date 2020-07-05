export const measureFunctionDuration = async (fn) => {
  const startTime = Date.now()
  const value = await fn()
  const endTime = Date.now()
  return [endTime - startTime, value]
}
