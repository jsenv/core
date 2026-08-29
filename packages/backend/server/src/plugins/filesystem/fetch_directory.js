import { lstatSync, readdirSync } from "node:fs";

import { pickContentType } from "../../content_negotiation/pick_content_type.js";
import { escapeHtml } from "../../internal/escape_html.js";

/**
 * Response listing a directory, as json (an array of names) or as an html
 * page of links depending on what the request accepts (json by default).
 *
 * @param {string|URL} url - The directory.
 * @param {Object} [params]
 * @param {Object} [params.headers={}] - Request headers, read for `accept`.
 * @param {string|URL} [params.rootDirectoryUrl] - Directory served at "/", so
 *   that the html links are relative to the server.
 * @returns {{ status: number, headers: Object, body: string }}
 */
export const fetchDirectory = (
  url,
  { headers = {}, rootDirectoryUrl } = {},
) => {
  url = String(url);
  url = url[url.length - 1] === "/" ? url : `${url}/`;
  const directoryContentArray = readdirSync(new URL(url));
  const responseProducers = {
    "application/json": () => {
      const directoryContentJson = JSON.stringify(
        directoryContentArray,
        null,
        "  ",
      );
      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(directoryContentJson),
        },
        body: directoryContentJson,
      };
    },
    "text/html": () => {
      const directoryAsHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Directory explorer</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <h1>Content of directory ${escapeHtml(url)}</h1>
    <ul>
      ${directoryContentArray.map((filename) => {
        const fileUrlObject = new URL(filename, url);
        const fileUrl = String(fileUrlObject);
        let fileUrlRelativeToServer = fileUrl.slice(
          String(rootDirectoryUrl).length,
        );
        if (lstatSync(fileUrlObject).isDirectory()) {
          fileUrlRelativeToServer += "/";
        }
        const linkHtml = escapeHtml(fileUrlRelativeToServer);
        return `<li>
        <a href="/${linkHtml}">${linkHtml}</a>
      </li>`;
      }).join(`
      `)}
    </ul>
  </body>
</html>`;

      return {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(directoryAsHtml),
        },
        body: directoryAsHtml,
      };
    },
  };
  const bestContentType = pickContentType(
    { headers },
    Object.keys(responseProducers),
  );
  return responseProducers[bestContentType || "application/json"]();
};
