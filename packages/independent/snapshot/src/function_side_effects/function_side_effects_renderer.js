export const renderSideEffects = (sideEffects) => {
  let string = "";
  let index = 0;
  for (const sideEffect of sideEffects) {
    if (sideEffect.skippable) {
      continue;
    }
    if (string) {
      string += "\n\n";
    }
    let label = `${index + 1}. ${sideEffect.label}`;
    let text = sideEffect.text;
    string += label;
    if (text) {
      string += "\n";
      string += text;
    }
    index++;
  }
  return string;
};

export const wrapIntoMarkdownBlock = (value, blockName = "") => {
  const start = "```";
  const end = "```";
  return `${start}${blockName}
${value}
${end}`;
};
