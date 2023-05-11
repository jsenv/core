import { inspectValue } from "./inspect_value.js";

export const inspect = (
  value,
  {
    parenthesis = false,
    quote = "auto",
    canUseTemplateString = true,
    useNew = false,
    objectConstructor = false,
    showFunctionBody = false,
    indentUsingTab = false,
    indentSize = 2,
    numericSeparator = true,
  } = {},
) => {
  const scopedInspect = (scopedValue, scopedOptions) => {
    const options = {
      ...scopedOptions,
      nestedInspect: (nestedValue, nestedOptions = {}) => {
        return scopedInspect(nestedValue, {
          ...scopedOptions,
          depth: scopedOptions.depth + 1,
          ...nestedOptions,
        });
      },
    };
    return inspectValue(scopedValue, options);
  };

  return scopedInspect(value, {
    parenthesis,
    quote,
    canUseTemplateString,
    useNew,
    objectConstructor,
    showFunctionBody,
    indentUsingTab,
    indentSize,
    numericSeparator,
    depth: 0,
  });
};
