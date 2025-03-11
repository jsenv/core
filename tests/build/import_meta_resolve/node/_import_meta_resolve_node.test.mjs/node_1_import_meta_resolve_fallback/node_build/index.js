const resolvePackageName = new URL("./", import.meta.url).href;
const resolvePackageSubpath = new URL("./json/package.json", import.meta.url).href;
const resolveFoo = new URL("./js/foo.js", import.meta.url).href;
const resolveBar = new URL("bar/package.json", import.meta.url).href;

export { resolveBar, resolveFoo, resolvePackageName, resolvePackageSubpath };
