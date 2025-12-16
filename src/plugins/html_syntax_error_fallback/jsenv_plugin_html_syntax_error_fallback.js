import { parseHtml } from "@jsenv/ast";
import { errorToHTML, generateContentFrame } from "@jsenv/humanize";
import { urlToRelativeUrl } from "@jsenv/urls";
import { readFileSync } from "node:fs";
import { jsenvCoreDirectoryUrl } from "../../jsenv_core_directory_url.js";

export const jsenvPluginHtmlSyntaxErrorFallback = () => {
  const htmlSyntaxErrorFileUrl = import.meta
    .resolve("./client/html_syntax_error.html");

  return {
    mustStayFirst: true,
    name: "jsenv:html_syntax_error_fallback",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        try {
          parseHtml({
            html: urlInfo.content,
            url: urlInfo.url,
          });
          return null;
        } catch (e) {
          if (e.code !== "PARSE_ERROR") {
            return null;
          }
          const line = e.line;
          const column = e.column;
          const htmlErrorContentFrame = generateContentFrame({
            content: urlInfo.content,
            line,
            column,
          });
          urlInfo.kitchen.context.logger
            .error(`Error while handling ${urlInfo.context.request ? urlInfo.context.request.url : urlInfo.url}:
${e.reasonCode}
${urlInfo.url}:${line}:${column}
${htmlErrorContentFrame}`);
          const html = generateHtmlForSyntaxError(e, {
            htmlUrl: urlInfo.url,
            rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
            htmlErrorContentFrame,
            htmlSyntaxErrorFileUrl,
          });
          return html;
        }
      },
    },
  };
};

const generateHtmlForSyntaxError = (
  htmlSyntaxError,
  { htmlUrl, rootDirectoryUrl, htmlErrorContentFrame, htmlSyntaxErrorFileUrl },
) => {
  const htmlForSyntaxError = String(
    readFileSync(new URL(htmlSyntaxErrorFileUrl)),
  );
  const htmlRelativeUrl = urlToRelativeUrl(htmlUrl, rootDirectoryUrl);
  const { line, column } = htmlSyntaxError;
  if (htmlUrl.startsWith(jsenvCoreDirectoryUrl.href)) {
    htmlUrl = urlToRelativeUrl(htmlUrl, jsenvCoreDirectoryUrl);
    htmlUrl = `@jsenv/core/${htmlUrl}`;
  }
  const urlWithLineAndColumn = `${htmlUrl}:${line}:${column}`;
  const replacers = {
    fileRelativeUrl: htmlRelativeUrl,
    reasonCode: htmlSyntaxError.reasonCode,
    errorLinkHref: `javascript:window.fetch('/.internal/open_file/${encodeURIComponent(
      urlWithLineAndColumn,
    )}')`,
    errorLinkText: `${htmlRelativeUrl}:${line}:${column}`,
    syntaxErrorHTML: errorToHTML(htmlErrorContentFrame),
  };
  const html = replacePlaceholders(htmlForSyntaxError, replacers);
  return html;
};
const replacePlaceholders = (html, replacers) => {
  return html.replace(/\$\{(\w+)\}/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    if (typeof replacer === "function") {
      return replacer();
    }
    return replacer;
  });
};
