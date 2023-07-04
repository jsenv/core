import { DATA_URL, injectQueryParamsIntoSpecifier } from "@jsenv/urls";

export const jsenvPluginInliningAsDataUrl = () => {
  return {
    name: "jsenv:inlining_as_data_url",
    appliesDuring: "*",
    // if the referenced url is a worker we could use
    // https://www.oreilly.com/library/view/web-workers/9781449322120/ch04.html
    // but maybe we should rather use ?object_url
    // or people could do this:
    // import workerText from './worker.js?text'
    // const blob = new Blob(workerText, { type: 'text/javascript' })
    // window.URL.createObjectURL(blob)
    // in any case the recommended way is to use an url
    // to benefit from shared worker and reuse worker between tabs
    formatReference: (reference) => {
      if (!reference.searchParams.has("inline")) {
        return null;
      }
      if (reference.type === "sourcemap_comment") {
        return null;
      }
      // <link rel="stylesheet"> and <script> can be inlined in the html
      if (
        reference.type === "link_href" &&
        reference.subtype === "stylesheet"
      ) {
        return null;
      }
      if (
        reference.original &&
        reference.original.type === "link_href" &&
        reference.original.subtype === "stylesheet"
      ) {
        return null;
      }
      if (reference.type === "script") {
        return null;
      }
      const specifierWithoutInline = reference.specifier
        .replace(`?inline`, "")
        .replace(`&inline`, "");
      const specifierWithBase64Param = injectQueryParamsIntoSpecifier(
        specifierWithoutInline,
        { as_base_64: "" },
      );
      const inlineReference = reference.becomesInline({
        line: reference.line,
        column: reference.column,
        isOriginal: reference.isOriginal,
        specifier: specifierWithBase64Param,
      });
      const inlineUrlInfo = inlineReference.urlInfo;
      return (async () => {
        await inlineUrlInfo.cook();
        const base64Url = DATA_URL.stringify({
          mediaType: inlineUrlInfo.contentType,
          base64Flag: true,
          data: inlineUrlInfo.content,
        });
        return base64Url;
      })();
    },
    fetchUrlContent: async (urlInfo) => {
      const withoutBase64ParamReference =
        urlInfo.firstReference.getWithoutSearchParam("as_base_64");
      if (!withoutBase64ParamReference) {
        return null;
      }
      const withoutBase64ParamUrlInfo = withoutBase64ParamReference.urlInfo;
      await withoutBase64ParamUrlInfo.cook();
      const contentAsBase64 = Buffer.from(
        withoutBase64ParamUrlInfo.content,
      ).toString("base64");
      return {
        originalContent: withoutBase64ParamUrlInfo.originalContent,
        content: contentAsBase64,
        contentType: withoutBase64ParamUrlInfo.contentType,
      };
    },
  };
};
