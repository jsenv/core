import { STATUS_CODES } from "node:http";
import { readFileSync } from "node:fs";

import { pickContentType } from "../../content_negotiation/pick_content_type.js";
import { escapeHtml } from "../../internal/escape_html.js";
import { asReasonPhrase } from "../../internal/reason_phrase.js";
import { replacePlaceholdersInHtml } from "../../replace_placeholder_in_html.js";

const clientErrorHtmlTemplateFileUrl = import.meta.resolve("./client/4xx.html");
let clientErrorHtmlTemplate;
const readClientErrorHtmlTemplate = () => {
  if (clientErrorHtmlTemplate === undefined) {
    clientErrorHtmlTemplate = readFileSync(
      new URL(clientErrorHtmlTemplateFileUrl),
      "utf8",
    );
  }
  return clientErrorHtmlTemplate;
};

export const serverPluginDefaultBody4xx5xx = () => {
  return {
    name: "jsenv:default_body_4xx_5xx",

    injectResponseProperties: (request, responseProperties) => {
      if (responseProperties.body !== undefined) {
        return null;
      }
      if (responseProperties.status >= 400 && responseProperties.status < 600) {
        return generateBadStatusResponse(request, responseProperties);
      }
      return null;
    },
  };
};

const generateBadStatusResponse = (
  request,
  { status, statusText, statusMessage },
) => {
  statusText = asReasonPhrase(statusText || STATUS_CODES[status] || "");
  const contentTypeNegotiated = pickContentType(request, [
    "text/html",
    "text/plain",
    "application/json",
  ]);
  if (contentTypeNegotiated === "text/html") {
    const html = replacePlaceholdersInHtml(readClientErrorHtmlTemplate(), {
      status,
      statusText: escapeHtml(statusText),
      statusMessage: statusMessage ? statusMessageToHtml(statusMessage) : "",
    });
    return new Response(html, {
      headers: { "content-type": "text/html" },
      status,
      statusText,
    });
  }
  if (contentTypeNegotiated === "text/plain") {
    return new Response(statusMessage, {
      status,
      statusText,
    });
  }
  return Response.json(
    { statusMessage },
    {
      status,
      statusText,
    },
  );
};

// A status message echoes the request (its url for instance): it is escaped
// before urls and resources are turned into links.
const statusMessageToHtml = (statusMessage) => {
  let html = escapeHtml(statusMessage);
  html = html.replace(/https?:\/\/\S+/g, (url) => {
    return `<a href="${url}">${url}</a>`;
  });
  html = html.replace(/(^|\s)(\/\S+)/g, (match, startOrSpace, resource) => {
    let end = "";
    if (resource[resource.length - 1] === ".") {
      resource = resource.slice(0, -1);
      end = ".";
    }
    return `${startOrSpace}<a href="${resource}">${resource}</a>${end}`;
  });
  html = html.replace(/\r\n|\r|\n/g, "<br />");
  return html;
};
