import "/js/file.js";

const textFileUrl = new URL(__v__("/other/file.txt"), import.meta.url).href;
console.log(textFileUrl);
const absoluteUrl = new URL("http://example.com/file.txt", "https://jsenv.dev")
  .href;
console.log(absoluteUrl);

const windowLocationRelativeUrl = {
  toto: new URL(__v__("/other/file.txt"), window.location).href,
}.toto;
const windowOriginRelativeUrl = new URL(__v__("/other/file.txt"), window.origin).href;
const absoluteBaseUrl = new URL("./file.txt", "http://jsenv.dev").href;

window.resolveResultPromise({
  textFileUrl: textFileUrl.replace(window.origin, "window.origin"),
  absoluteUrl,
  windowLocationRelativeUrl: windowLocationRelativeUrl.replace(
    window.origin,
    "window.origin",
  ),
  windowOriginRelativeUrl: windowOriginRelativeUrl.replace(
    window.origin,
    "window.origin",
  ),
  absoluteBaseUrl: absoluteBaseUrl.replace(window.origin, "window.origin"),
});
