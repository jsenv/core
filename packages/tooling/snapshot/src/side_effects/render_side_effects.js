import { createException, stringifyException } from "@jsenv/exception";
import { writeFileSync } from "@jsenv/filesystem";
import { renderTerminalSvg } from "@jsenv/terminal-recorder";
import { urlToExtension, urlToRelativeUrl } from "@jsenv/urls";
import ansiRegex from "ansi-regex";
import { replaceFluctuatingValues } from "../replace_fluctuating_values.js";

export const createBigSizeEffect =
  ({ details, dedicatedFile }) =>
  (sideEffect, text) => {
    if (text.length > details.length) {
      return {
        type: "details",
        open: false,
      };
    }
    if (text.length > dedicatedFile.length) {
      return {
        type: "dedicated_file",
      };
    }
    const lineCount = text.split("\n").length;
    if (lineCount > details.lines) {
      return {
        type: "details",
        open: false,
      };
    }
    if (lineCount > dedicatedFile.lines) {
      return {
        type: "dedicated_file",
      };
    }
    return null;
  };

export const renderSideEffects = (
  sideEffects,
  {
    sourceFileUrl,
    sideEffectMdFileUrl,
    generateOutFileUrl,
    generatedBy = true,
    title,
    titleLevel = 1,
    getBigSizeEffect = createBigSizeEffect({
      details: { line: 15, length: 2000 },
      // dedicated_file not implemented yet
      // the idea is that some values like the return value can be big
      // and in that case we might want to move it to an other file
      dedicatedFile: { line: 50, length: 5000 },
    }),
    errorTransform,
  } = {},
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
  markdown += `# [${title}](${urlToRelativeUrl(sourceFileUrl, sideEffectMdFileUrl, { preferRelativeNotation: true })})`;
  markdown += "\n\n";
  let sideEffectNumber = 0;
  for (const sideEffect of sideEffects) {
    if (sideEffect.skippable) {
      continue;
    }
    if (sideEffect.code === "source_code") {
      continue;
    }
    sideEffectNumber++;
    sideEffect.number = sideEffectNumber;
  }
  const lastSideEffectNumber = sideEffectNumber;

  let sideEffectMd = "";
  for (const sideEffect of sideEffects) {
    if (sideEffect.skippable) {
      continue;
    }
    if (sideEffectMd) {
      sideEffectMd += "\n\n";
    }
    sideEffectMd += renderOneSideEffect(sideEffect, {
      sideEffectMdFileUrl,
      generateOutFileUrl,
      rootDirectoryUrl,
      titleLevel,
      getBigSizeEffect,
      replace,
      errorTransform,
      lastSideEffectNumber,
    });
  }
  markdown += sideEffectMd;
  if (generatedBy) {
    markdown += "\n\n";
    markdown += "---";
    markdown += "\n\n";
    markdown += renderSmallLink(
      {
        text: "@jsenv/snapshot",
        href: "https://github.com/jsenv/core/tree/main/packages/tooling/snapshot",
      },
      { prefix: "Generated by " },
    );
    markdown += "\n";
  }
  return markdown;
};

export const renderInfosTableMd = (infos) => {
  const infoKeys = Object.keys(infos);
  if (infoKeys.length === 0) {
    return "";
  }
  let infoTableMd = "";
  infoTableMd += "\n";
  infoTableMd += `Infos | &nbsp;`;
  infoTableMd += "\n";
  infoTableMd += `----- | ------`;
  for (const key of infoKeys) {
    infoTableMd += "\n";
    infoTableMd += `${key} | ${infos[key]}`;
  }
  infoTableMd += "\n";
  return infoTableMd;
};

export const renderSmallLink = (
  link,
  { prefix = "", suffix = "", indent } = {},
) => {
  return renderSubMarkdown(
    `${prefix}<a href="${link.href}">${link.text}</a>${suffix}`,
    {
      indent,
    },
  );
};

const renderSubMarkdown = (content, { indent = 0 }) => {
  return `${"  ".repeat(indent)}<sub>
${"  ".repeat(indent + 1)}${content}
${"  ".repeat(indent)}</sub>`;
};

const renderOneSideEffect = (
  sideEffect,
  {
    sideEffectMdFileUrl,
    generateOutFileUrl,
    rootDirectoryUrl,
    titleLevel,
    getBigSizeEffect,
    replace,
    errorTransform,
    lastSideEffectNumber,
  },
) => {
  const { render } = sideEffect;
  if (typeof render !== "object") {
    throw new TypeError(
      `sideEffect.render should be an object, got ${render} on side effect with type "${sideEffect.type}"`,
    );
  }
  const { md } = sideEffect.render;
  let { label, text } = md({
    sideEffectMdFileUrl,
    generateOutFileUrl,
    replace,
    rootDirectoryUrl,
    lastSideEffectNumber,
  });
  if (text) {
    if (
      sideEffect.number === 1 &&
      lastSideEffectNumber === 1 &&
      (sideEffect.code === "return" ||
        sideEffect.code === "throw" ||
        sideEffect.code === "resolve" ||
        sideEffect.code === "reject")
    ) {
      label = null;
    }
    text = renderText(text, {
      sideEffect,
      sideEffectMdFileUrl,
      generateOutFileUrl,
      replace,
      rootDirectoryUrl,
      errorTransform,
    });
  }
  if (sideEffect.code === "source_code") {
    return text;
  }
  if (!label) {
    return text;
  }
  const stepTitle = `${"#".repeat(titleLevel)} ${sideEffect.number}/${lastSideEffectNumber} ${replace(label)}`;
  if (!text) {
    return stepTitle;
  }
  const bigSizeEffect = getBigSizeEffect(sideEffect, text);
  if (!bigSizeEffect) {
    return `${stepTitle}

${text}`;
  }
  // for now we'll use details
  const { open } = bigSizeEffect;
  return `${stepTitle}
  ${renderMarkdownDetails(text, {
    open,
    summary: "details",
  })}`;
};

const renderText = (
  text,
  {
    sideEffect,
    sideEffectMdFileUrl,
    generateOutFileUrl,
    replace,
    rootDirectoryUrl,
    errorTransform,
  },
) => {
  if (text && typeof text === "object") {
    if (text.type === "source_code") {
      const { sourceCode, callSite } = text.value;
      let sourceMd = renderMarkdownBlock(sourceCode, "js");
      if (!callSite) {
        return sourceMd;
      }
      const callSiteRelativeUrl = urlToRelativeUrl(
        callSite.url,
        sideEffectMdFileUrl,
        { preferRelativeNotation: true },
      );
      const sourceCodeLinkText = `${callSiteRelativeUrl}:${callSite.line}:${callSite.column}`;
      const sourceCodeLinkHref = `${callSiteRelativeUrl}#L${callSite.line}`;
      sourceMd += "\n";
      sourceMd += renderSmallLink({
        text: sourceCodeLinkText,
        href: sourceCodeLinkHref,
      });
      return sourceMd;
    }
    if (text.type === "js_value") {
      const jsValue = text.value;
      if (jsValue === undefined) {
        return renderMarkdownBlock("undefined", "js");
      }
      if (
        jsValue instanceof Error ||
        (jsValue &&
          jsValue.constructor &&
          jsValue.constructor.name.includes("Error") &&
          jsValue.stack &&
          typeof jsValue.stack === "string")
      ) {
        // return renderMarkdownBlock(text.value.stack);
        const exception = createException(jsValue, {
          rootDirectoryUrl,
          errorTransform,
        });
        const exceptionText = stringifyException(exception);
        return renderPotentialAnsi(exceptionText, {
          stringType: "error",
          sideEffect,
          sideEffectMdFileUrl,
          generateOutFileUrl,
          replace,
        });
      }
      return renderMarkdownBlock(replace(jsValue), "js");
    }
    if (text.type === "console") {
      return renderConsole(text.value, {
        sideEffect,
        sideEffectMdFileUrl,
        generateOutFileUrl,
        replace,
      });
    }
    if (text.type === "file_content") {
      return renderFileContent(text, {
        sideEffect,
        replace,
      });
    }
    if (text.type === "link") {
      return renderLinkMarkdown(text.value, { replace });
    }
  }
  return replace(text);
};

export const renderConsole = (
  string,
  { sideEffect, sideEffectMdFileUrl, generateOutFileUrl, replace },
) => {
  return renderPotentialAnsi(string, {
    stringType: "console",
    sideEffect,
    sideEffectMdFileUrl,
    generateOutFileUrl,
    replace,
  });
};

const renderPotentialAnsi = (
  string,
  { stringType, sideEffect, sideEffectMdFileUrl, generateOutFileUrl, replace },
) => {
  const rawTextBlock = renderMarkdownBlock(
    replace(string, { stringType }),
    "console",
  );
  // for assert we want ideally hummm
  // colored in details block?
  const includesAnsi = ansiRegex().test(string);
  if (!includesAnsi) {
    return rawTextBlock;
  }
  const svgFilename = `${sideEffect.code}${sideEffect.counter ? `_${sideEffect.counter}` : ""}.svg`;
  const svgFileUrl = generateOutFileUrl(svgFilename);
  let svgFileContent = renderTerminalSvg(
    replace(string, { stringType: "console", preserveAnsi: true }),
    {
      head: false,
      paddingTop: 10,
      paddingBottom: 10,
    },
  );
  svgFileContent = replace(svgFileContent, { fileUrl: svgFileUrl });
  writeFileSync(svgFileUrl, svgFileContent);
  const svgFileRelativeUrl = urlToRelativeUrl(svgFileUrl, sideEffectMdFileUrl);
  let md = `![img](${svgFileRelativeUrl})`;
  md += "\n\n";
  md += renderMarkdownDetails(`${rawTextBlock}`, {
    summary: "see without style",
  });
  md += "\n";
  return md;
};

export const renderFileContent = (text, { sideEffect, replace }) => {
  const { url, buffer, outDirectoryReason } = sideEffect.value;
  const { value } = text;
  let content = value;
  if (outDirectoryReason) {
    const { outRelativeUrl, urlInsideOutDirectory } = text;
    writeFileSync(urlInsideOutDirectory, replace(buffer, { fileUrl: url }));
    let md = "";
    if (
      outDirectoryReason === "lot_of_chars" ||
      outDirectoryReason === "lot_of_lines"
    ) {
      md += "\n";
      md += renderMarkdownBlock(escapeMarkdownBlockContent(replace(content)));
      const fileLink = renderLinkMarkdown(
        {
          text: outRelativeUrl,
          href: outRelativeUrl,
        },
        { replace },
      );
      md += `\nsee ${fileLink} for more`;
      return md;
    }
    md += `see `;
    md += renderLinkMarkdown(
      {
        text: outRelativeUrl,
        href: outRelativeUrl,
      },
      { replace },
    );
    return md;
  }
  const extension = urlToExtension(url);
  if (extension === ".md") {
    content = escapeMarkdownBlockContent(content);
  }
  return renderMarkdownBlock(
    replace(content, { fileUrl: url }),
    extension.slice(1),
  );
};

const escapeMarkdownBlockContent = (content) => {
  let escaped = "";
  for (const char of content.split("")) {
    if (["`"].includes(char)) {
      escaped += `\\${char}`;
    } else {
      escaped += char;
    }
  }
  return escaped;
};

// const escapeMarkdown = (content) => {
//   let escaped = "";
//   for (const char of content.split("")) {
//     if (
//       [
//         "`",
//         "*",
//         "_",
//         "{",
//         "}",
//         "[",
//         "]",
//         "(",
//         ")",
//         "#",
//         "+",
//         "-",
//         ".",
//         "!",
//       ].includes(char)
//     ) {
//       escaped += `\\${char}`;
//     } else {
//       escaped += char;
//     }
//   }
//   return escaped;
// };

export const renderLinkMarkdown = ({ href, text }, { replace }) => {
  return `[${replace(text)}](${replace(href)})`;
};

export const renderMarkdownDetails = (text, { open, summary, indent = 0 }) => {
  return `${"  ".repeat(indent)}<details${open ? " open" : ""}>
${"  ".repeat(indent + 1)}<summary>${summary}</summary>

${text}

${"  ".repeat(indent)}</details>`;
};

export const renderMarkdownBlock = (value, blockName = "") => {
  const start = "```";
  const end = "```";
  return `${start}${blockName}
${value}
${end}`;
};
