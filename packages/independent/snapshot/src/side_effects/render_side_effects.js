import { replaceFluctuatingValues } from "../replace_fluctuating_values.js";

export const createMaxLineCondition = (maxLines) => (sideEffect, text) =>
  text.split("\n").length < maxLines;

export const renderSideEffects = (
  sideEffects,
  { detailsShouldOpen = createMaxLineCondition(5) } = {},
) => {
  const { rootDirectoryUrl, replaceFilesystemWellKnownValues } =
    sideEffects.options;

  const replace = (value, options) => {
    return replaceFluctuatingValues(value, {
      replaceFilesystemWellKnownValues,
      rootDirectoryUrl,
      ...options,
    });
  };

  let markdown = "";
  let index = 0;
  for (const sideEffect of sideEffects) {
    if (sideEffect.skippable) {
      continue;
    }
    if (markdown) {
      markdown += "\n\n";
    }
    const { render } = sideEffect;
    if (typeof render !== "object") {
      throw new TypeError(
        `sideEffect.render should be an object, got ${render} on side effect with type "${sideEffect.type}"`,
      );
    }
    const { md } = sideEffect.render;
    const { label, text } = md({ replace, rootDirectoryUrl });

    const stepLabel = `${index + 1}. ${label}`;
    if (text) {
      const shouldOpen = detailsShouldOpen(sideEffect, text);
      let step = `<details${shouldOpen ? " open" : ""}>
  <summary>${stepLabel}</summary>

${text}
</details>`;
      markdown += step;
    } else {
      markdown += stepLabel;
    }
    index++;
  }
  return markdown;
};

export const wrapIntoMarkdownBlock = (value, blockName = "") => {
  const start = "```";
  const end = "```";
  return `${start}${blockName}
${value}
${end}`;
};
