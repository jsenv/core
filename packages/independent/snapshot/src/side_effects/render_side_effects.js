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
  const renderLabel = (label) => {
    return replaceFluctuatingValues(label, {
      replaceFilesystemWellKnownValues,
      rootDirectoryUrl,
    });
  };
  const renderText = (text) => {
    return replaceFluctuatingValues(text, {
      replaceFilesystemWellKnownValues,
      rootDirectoryUrl,
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

    const { md } = sideEffect.render;
    const { label, text } = md({ rootDirectoryUrl });
    let title = `${index + 1}. ${renderLabel(label)}`;
    markdown += title;
    if (text) {
      markdown += "\n";
      markdown += renderText(text);
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
