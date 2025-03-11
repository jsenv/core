export const inspectBigIntObject = (value, { nestedHumanize }) => {
  const bigIntSource = nestedHumanize(value.valueOf());

  return `BigInt(${bigIntSource})`;
};
