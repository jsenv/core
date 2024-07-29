import { createReplaceFilesystemWellKnownValues } from "../filesystem_well_known_values.js";
import { replaceFluctuatingValues } from "../replace_fluctuating_values.js";

export const renderSideEffects = (
  sideEffects,
  {
    rootDirectoryUrl,
    replaceFilesystemWellKnownValues = createReplaceFilesystemWellKnownValues({
      rootDirectoryUrl,
    }),
  },
) => {
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
    let title = `${index + 1}. ${label}`;
    markdown += title;
    if (text) {
      markdown += "\n";
      markdown += text;
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
