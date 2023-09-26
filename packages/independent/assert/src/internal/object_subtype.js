export const isRegExp = (value) =>
  somePrototypeMatch(
    value,
    ({ constructor }) => constructor && constructor.name === "RegExp",
  );

export const isArray = (value) =>
  somePrototypeMatch(
    value,
    ({ constructor }) => constructor && constructor.name === "Array",
  );

export const isError = (value) =>
  somePrototypeMatch(
    value,
    ({ constructor }) => constructor && constructor.name === "Error",
  );

export const isSet = (value) =>
  somePrototypeMatch(
    value,
    ({ constructor }) => constructor && constructor.name === "Set",
  );

export const isMap = (value) =>
  somePrototypeMatch(
    value,
    ({ constructor }) => constructor && constructor.name === "Map",
  );

export const somePrototypeMatch = (value, predicate) => {
  let prototype = Object.getPrototypeOf(value);
  while (prototype) {
    if (predicate(prototype)) return true;
    prototype = Object.getPrototypeOf(prototype);
  }
  return false;
};
