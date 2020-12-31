export async function* ask() {
  const value = await Promise.resolve(42)
  yield value
}
