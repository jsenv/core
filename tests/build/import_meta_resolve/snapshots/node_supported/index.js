const resolvePackageName = new URL("./", import.meta.url).href;
const resolvePackageSubpath = new URL("./json/package.json", import.meta.url).href;

export { resolvePackageName, resolvePackageSubpath };
