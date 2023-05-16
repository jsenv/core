import { DATA_URL } from "@jsenv/urls";

export const jsenvPluginInliningAsDataUrl = () => {
  return {
    name: "jsenv:inlining_as_data_url",
    appliesDuring: "*",
    formatReference: {
      // if the referenced url is a worker we could use
      // https://www.oreilly.com/library/view/web-workers/9781449322120/ch04.html
      // but maybe we should rather use ?object_url
      // or people could do this:
      // import workerText from './worker.js?text'
      // const blob = new Blob(workerText, { type: 'text/javascript' })
      // window.URL.createObjectURL(blob)
      // in any case the recommended way is to use an url
      // to benefit from shared worker and reuse worker between tabs
      "*": (reference, context) => {
        if (
          !reference.original ||
          !reference.original.searchParams.has("inline")
        ) {
          return null;
        }
        // <link rel="stylesheet"> and <script> can be inlined in the html
        if (
          reference.type === "link_href" &&
          reference.subtype === "stylesheet"
        ) {
          return null;
        }
        if (reference.type === "script") {
          return null;
        }
        return (async () => {
          const urlInfo = context.urlGraph.getUrlInfo(reference.url);
          await context.cook(urlInfo, { reference });
          const contentAsBase64 = Buffer.from(urlInfo.content).toString(
            "base64",
          );
          const specifier = DATA_URL.stringify({
            mediaType: urlInfo.contentType,
            base64Flag: true,
            data: contentAsBase64,
          });
          context.referenceUtils.becomesInline(reference, {
            line: reference.line,
            column: reference.column,
            isOriginal: reference.isOriginal,
            specifier,
            content: contentAsBase64,
            contentType: urlInfo.contentType,
          });
          return specifier;
        })();
      },
    },
  };
};
