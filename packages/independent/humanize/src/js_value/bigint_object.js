export const inspectBigIntObject = (value, { nestedInspect }) => {
  const bigIntSource = nestedhumanize(value.valueOf());

  return `BigInt(${bigIntSource})`;
};
