const resolvePackageName = import.meta.resolve("./");
const resolvePackageSubpath = import.meta.resolve("./package.json");
const resolveFoo = import.meta.resolve("./foo.js");
const resolveBar = import.meta.resolve("bar/package.json");

export { resolveBar, resolveFoo, resolvePackageName, resolvePackageSubpath };
