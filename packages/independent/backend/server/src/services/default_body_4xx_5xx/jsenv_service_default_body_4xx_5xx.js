import { readFileSync } from "node:fs";
import { pickContentType } from "../../content_negotiation/pick_content_type.js";
import { replacePlaceholdersInHtml } from "../../replace_placeholder_in_html.js";

const clientErrorHtmlTemplateFileUrl = import.meta.resolve("./client/4xx.html");

export const jsenvServiceDefaultBody4xx5xx = () => {
  return {
    name: "jsenv:default_body_4xx_5xx",

    injectResponseProperties: (request, responseProperties) => {
      if (responseProperties.body !== undefined) {
        return null;
      }
      if (responseProperties.status >= 400 && responseProperties.status < 500) {
        return generateClientErrorResponse(request, responseProperties);
      }
      if (responseProperties.status >= 500 && responseProperties.status < 600) {
        return generateClientErrorResponse(request, responseProperties);
      }
      return null;
    },
  };
};

const generateClientErrorResponse = (
  request,
  { status, statusText, statusMessage },
) => {
  const contentTypeNegotiated = pickContentType(request, [
    "text/html",
    "application/json",
    "text/plain",
  ]);
  if (contentTypeNegotiated === "text/html") {
    const htmlTemplate = readFileSync(
      new URL(clientErrorHtmlTemplateFileUrl),
      "utf8",
    );
    const html = replacePlaceholdersInHtml(htmlTemplate, {
      status,
      statusText,
      statusMessage: statusMessage || "",
    });
    return new Response(html, {
      headers: { "content-type": "text/html" },
    });
  }
  if (contentTypeNegotiated === "application/json") {
    return Response.json({ statusMessage }, { status, statusText });
  }
  return new Response(statusMessage, { status, statusText });
};
