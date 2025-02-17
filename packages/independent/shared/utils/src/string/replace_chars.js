export const replaceChars = (string, replace) => {
  let result = "";
  let last = 0;
  let i = 0;
  while (i < string.length) {
    const replacement =
      typeof replace === "object"
        ? replace[string[i]]
        : replace(string[i], i, string);
    i++;
    if (replacement) {
      if (last === i - 1) {
        result += replacement;
      } else {
        result += `${string.slice(last, i - 1)}${replacement}`;
      }
      last = i;
    }
  }
  if (last !== string.length) {
    result += string.slice(last);
  }
  return result;
};
