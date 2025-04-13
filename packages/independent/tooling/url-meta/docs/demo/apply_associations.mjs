import { URL_META } from "@jsenv/url-meta";

const associations = {
  insideSrc: {
    "file:///src/": true,
  },
  extensionIsJs: {
    "file:///**/*.js": true,
  },
};

const urlA = "file:///src/file.js";
const urlB = "file:///src/file.json";
console.log(
  `${urlA}: ${JSON.stringify(
    URL_META.applyAssociations({ url: urlA, associations }),
    null,
    "  ",
  )}`,
);
console.log(
  `${urlB}: ${JSON.stringify(
    URL_META.applyAssociations({ url: urlB, associations }),
    null,
    "  ",
  )}`,
);
