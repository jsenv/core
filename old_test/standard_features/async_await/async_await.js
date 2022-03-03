export const ask = async () => {
  const value = await Promise.resolve(42)
  return value
}
