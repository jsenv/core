export const respond = async () => {
  const value = await Promise.resolve(42)
  return value
}
