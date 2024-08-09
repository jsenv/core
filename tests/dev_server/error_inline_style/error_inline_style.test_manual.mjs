import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "debug",
  sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
  sourceMainFilePath: "main.html",
  plugins: [
    {
      transformUrlContent: {
        css: (urlInfo) => {
          if (urlInfo.content.includes("yellow")) {
            throw new Error("here");
          }
        },
      },
    },
  ],
});
