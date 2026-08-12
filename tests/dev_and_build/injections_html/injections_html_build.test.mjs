/*
 * An injection in html is substituted as-is, so it can be concatenated with
 * surrounding text: "__BACKEND_URL__/users/me" -> "https://api.example.com/users/me".
 * In an inline <script> it becomes a JS literal instead, which is how the value
 * reaches every js file of the page (window.backendUrl).
 *
 * The attribute case exists mostly for resource hints (<link rel="preconnect">,
 * <link rel="preload">), but the executed page below demoes it on a plain
 * data-* attribute: a resource hint would make the browser hit the network.
 * Resource hints are covered by the second test, which only builds.
 *
 * The third test covers a value the build cannot know: a review app deployed on
 * pr-<n>-app.example.com talks to the api of its own pull request. The build
 * leaves the placeholder in place and the server serving the build files
 * substitutes it per request, so the same build files serve every deployment.
 *
 * The last two tests cover resource hints written without "jsenv-ignore": an
 * attribute holds its injected value before references are analyzed, so the hint
 * survives on its own. A hint jsenv cannot resolve at all is kept too, with the
 * url as authored and a warning — a tag nobody can explain must not vanish.
 */

import { build, INJECTIONS, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import { readFileSync } from "node:fs";

const buildDirectoryUrl = import.meta.resolve("./build/");
const mainHtmlBuildUrl = new URL("./build/main.html", import.meta.url);

const buildClient = async (clientDirectoryUrl, { injections } = {}) => {
  await build({
    sourceDirectoryUrl: clientDirectoryUrl,
    buildDirectoryUrl,
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        injections,
      },
    },
  });
};

const backendUrlInjections = {
  "./main.html": () => {
    return {
      __BACKEND_URL__: "https://api.example.com",
      // a global is injected into the document itself, never into what it inlines
      // (its <style> could not receive it)
      appVersion: INJECTIONS.global("1.2.3"),
    };
  },
};

const run = async () => {
  await buildClient(import.meta.resolve("./client/"), {
    injections: backendUrlInjections,
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

const reviewAppPattern = /^pr-(\d+)-app\.example\.com$/;
const resolveBackendUrl = (host) => {
  const reviewAppMatch = reviewAppPattern.exec(host);
  if (reviewAppMatch) {
    return `https://pr-${reviewAppMatch[1]}-api.example.com`;
  }
  return "https://api.example.com";
};

const runPerRequest = async () => {
  await buildClient(import.meta.resolve("./review_app/client/"));
  const buildServer = await startBuildServer({
    buildDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
    routes: [
      {
        endpoint: "GET /main.html",
        description: "Serve main.html with the backend url of this deployment",
        fetch: (request) => {
          const html = readFileSync(mainHtmlBuildUrl, "utf8");
          // a review app is served behind a proxy holding the public hostname
          const backendUrl = resolveBackendUrl(
            request.headers["x-forwarded-host"] || request.headers.host,
          );
          // the placeholder sits in a <script>, so the value must be a JS literal,
          // exactly what jsenv would have injected there during the build
          return new Response(
            html.replaceAll("__BACKEND_URL__", JSON.stringify(backendUrl)),
            { headers: { "content-type": "text/html" } },
          );
        },
      },
    ],
  });
  const readBackendUrl = async (host) => {
    const response = await fetch(`${buildServer.origin}/main.html`, {
      headers: { "x-forwarded-host": host },
    });
    const html = await response.text();
    return /window\.backendUrl = "(.*?)"/.exec(html)[1];
  };

  return {
    fromReviewApp: await readBackendUrl("pr-42-app.example.com"),
    fromProd: await readBackendUrl("www.example.com"),
    // the page reports what "export const BACKEND_URL = window.backendUrl" got
    inBrowser: await executeHtml(`${buildServer.origin}/main.html`),
  };
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("backend_url_shared", () => run());
  test("backend_url_in_resource_hints", () =>
    buildClient(import.meta.resolve("./resource_hints/client/"), {
      injections: backendUrlInjections,
    }));
  test("backend_url_per_request", () => runPerRequest());
  test("resource_hint_without_jsenv_ignore", () =>
    buildClient(import.meta.resolve("./resource_hints_not_ignored/client/"), {
      injections: backendUrlInjections,
    }));
  test("resource_hint_unresolved", () =>
    buildClient(import.meta.resolve("./resource_hints_unresolved/client/"), {
      injections: backendUrlInjections,
    }));
});
