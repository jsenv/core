/*
 * OK JE SAIS
 * c'est parce que en fait lorsqu'on voit le
 * style.css -> style.css?as_css_module
 * donc pour file.js les deps sont juste style.css?as_css_module
 * ce n'est que lors du fetch de style.css?as_css_module
 * qu'on injecte une ref sur file.js vers style.css
 * donc du point de vue de jsenv
 * file.js ne dépend plus de style.css
 * meme si juste apres le browser va request style.css?as_css_module
 * et donc restaurer cette dépendance
 *
 * il faut donc une ref implicite ou un placeholder de ref je dirais
 * pour ne pas perdre cet info
 */

import { startDevServer } from "@jsenv/core";

await startDevServer({
  serverLogLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  supervisor: false,
  transpilation: {
    importAssertions: {
      css: true,
    },
  },
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  sourcemaps: "none",
});
