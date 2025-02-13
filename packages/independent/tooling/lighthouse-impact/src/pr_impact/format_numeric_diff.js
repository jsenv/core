const enDecimalFormatter = new Intl.NumberFormat("en", { style: "decimal" });

export const formatNumericDiff = (valueAsNumber) => {
  const valueAsAbsoluteNumber = Math.abs(valueAsNumber);
  const valueAsString = enDecimalFormatter.format(valueAsAbsoluteNumber);

  if (valueAsNumber < 0) {
    return `-${valueAsString}`;
  }
  if (valueAsNumber > 0) {
    return `+${valueAsString}`;
  }
  return valueAsString;
};
