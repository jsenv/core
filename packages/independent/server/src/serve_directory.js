import { readdirSync } from "node:fs";

import { pickContentType } from "./content_negotiation/pick_content_type.js";

export const serveDirectory = (
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
          "content-length": directoryContentJson.length,
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
    <h1>Content of directory ${url}</h1>
    <ul>
      ${directoryContentArray.map((filename) => {
        const fileUrl = String(new URL(filename, url));
        const fileUrlRelativeToServer = fileUrl.slice(
          String(rootDirectoryUrl).length,
        );
        return `<li>
        <a href="/${fileUrlRelativeToServer}">${fileUrlRelativeToServer}</a>
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
