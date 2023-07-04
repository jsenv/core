import { DATA_URL, injectQueryParamsIntoSpecifier } from "@jsenv/urls";

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
      "*": (reference) => {
        const originalReference = reference.original || reference;
        if (!originalReference.searchParams.has("inline")) {
          return null;
        }
        // <link rel="stylesheet"> and <script> can be inlined in the html
        if (
          originalReference.type === "link_href" &&
          originalReference.subtype === "stylesheet"
        ) {
          return null;
        }
        if (originalReference.type === "script") {
          return null;
        }
        const specifierWithBase64Param = injectQueryParamsIntoSpecifier(
          reference.specifier,
          { as: "base64" },
        );
        const inlineReference = reference.becomesInline({
          line: reference.line,
          column: reference.column,
          isOriginal: reference.isOriginal,
          specifier: specifierWithBase64Param,
        });
        return (async () => {
          await inlineReference.urlInfo.cook();
          const base64Url = DATA_URL.stringify({
            mediaType: inlineReference.urlInfo.contentType,
            base64Flag: true,
            data: inlineReference.content,
          });
          return base64Url;
        })();
      },
    },
    transformUrlContent: (urlInfo) => {
      if (urlInfo.searchParams.has("as_base_64")) {
        return Buffer.from(urlInfo.content).toString("base64");
      }
      return null;
    },
  };
};
