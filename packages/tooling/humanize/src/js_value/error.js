import { inspectConstructor } from "./constructor.js";

export const inspectError = (
  error,
  { nestedHumanize, useNew, parenthesis },
) => {
  const messageSource = nestedHumanize(error.message);

  const errorSource = inspectConstructor(
    `${errorToConstructorName(error)}(${messageSource})`,
    {
      useNew,
      parenthesis,
    },
  );
  return errorSource;
};

const errorToConstructorName = ({ name }) => {
  if (derivedErrorNameArray.includes(name)) {
    return name;
  }
  return "Error";
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
const derivedErrorNameArray = [
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
];
