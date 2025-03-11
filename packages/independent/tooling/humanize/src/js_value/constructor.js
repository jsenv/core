export const inspectConstructor = (value, { parenthesis, useNew }) => {
  let formattedString = value;
  if (parenthesis) {
    formattedString = `(${value})`;
  }
  if (useNew) {
    formattedString = `new ${formattedString}`;
  }
  return formattedString;
};
