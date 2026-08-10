/*
 * cmd+K (ctrl+K elsewhere) on any page the dev server serves opens a list of
 * the .html files it serves, filter as you type, Enter to go there. cmd+E
 * (ctrl+E elsewhere) opens a page's file in the editor instead of going to it:
 * the current page from anywhere, the selected row from inside the switcher.
 *
 * The list is the one the filesystem plugin already publishes for everyone
 * (GET /.internal/pages.json, see protocol_file/html_pages.js) — this only adds
 * the way to reach it without leaving the page one is working on.
 *
 * Registered with the dev server rather than among the core plugins, next to
 * the other things that inject a client script: the script it adds is a
 * reference like any other, and it has to be added while references are still
 * being resolved — added later it stays a file:// url the browser refuses.
 *
 * A shortcut on every page is a shortcut taken from every page, so the page
 * comes first: the key is watched on the document, in the bubble phase, and
 * anything that called preventDefault on its way there keeps it. A page with
 * its own cmd+K owes nothing to this one.
 */

import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";

const clientFileUrl = new URL("./client/page_switcher.js", import.meta.url)
  .href;

export const jsenvPluginPageSwitcher = () => {
  return {
    name: "jsenv:page_switcher",
    // Dev only: it is a way around the source tree, which a built app has no
    // business carrying.
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        injectJsenvScript(htmlAst, {
          src: clientFileUrl,
          pluginName: "jsenv:page_switcher",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};
