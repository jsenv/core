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
        return (async () => {
          const referencedUrlInfo = reference.urlInfo;
          await referencedUrlInfo.cook();
          const contentAsBase64 = Buffer.from(
            referencedUrlInfo.content,
          ).toString("base64");
          let specifier = DATA_URL.stringify({
            mediaType: referencedUrlInfo.contentType,
            base64Flag: true,
            data: contentAsBase64,
          });
          reference.becomesInline({
            line: reference.line,
            column: reference.column,
            isOriginal: reference.isOriginal,
            specifier,
            content: contentAsBase64,
            contentType: referencedUrlInfo.contentType,
          });
          return specifier;
        })();
      },
    },
  };
};
