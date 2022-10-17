export const inspectBigIntObject = (value, { nestedInspect }) => {
  const bigIntSource = nestedInspect(value.valueOf())

  return `BigInt(${bigIntSource})`
}
