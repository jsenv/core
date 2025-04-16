export const generateSourcemapFileUrl = (url) => {
  const urlObject = new URL(url);
  let { origin, pathname, search, hash } = urlObject;
  // origin is "null" for "file://" urls with Node.js
  if (origin === "null" && urlObject.href.startsWith("file:")) {
    origin = "file://";
  }
  const sourcemapUrl = `${origin}${pathname}.map${search}${hash}`;
  return sourcemapUrl;
};

export const generateSourcemapDataUrl = (sourcemap) => {
  const asBase64 = Buffer.from(JSON.stringify(sourcemap)).toString("base64");
  return `data:application/json;charset=utf-8;base64,${asBase64}`;
};
