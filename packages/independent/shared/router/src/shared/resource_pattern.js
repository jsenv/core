import { PATTERN } from "./pattern.js";

export const createResourcePattern = (pattern) => {
  const resourcePattern = PATTERN.create(pattern, {
    namedGroupDelimiter: "/",
    // prepareStringToGenerate: (url) => {
    //   const urlToGenerate = new URL(pattern, url);
    //   const ressourceToGenerate = resourceFromUrl(urlToGenerate);
    //   return ressourceToGenerate;
    // },
    // finalizeGeneratedString: (generatedResource, url) => {
    //   const generatedUrl = new URL(generatedResource, url).href;
    //   return generatedUrl;
    // },
  });
  return resourcePattern;
};

// const resourceFromUrl = (url, baseUrl = "http://example.com") => {
//   url = String(url);
//   if (url[0] === "/") {
//     url = url.slice(1);
//   }
//   // if (url[0] !== "/") url = `/${url}`;
//   const urlObject = new URL(url, baseUrl);
//   const resource = urlObject.href.slice(urlObject.origin.length);
//   return resource;
// };
