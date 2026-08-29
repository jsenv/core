import { urlToFileSystemPath } from "@jsenv/urls";

export const applyCssTranspilation = async ({
  input,
  inputUrl,
  runtimeCompat,
}) => {
  // https://lightningcss.dev/docs.html
  const { transform } = await import("lightningcss");
  const targets = runtimeCompatToTargets(runtimeCompat);
  const { code, map } = transform({
    filename: urlToFileSystemPath(inputUrl),
    code: Buffer.from(input),
    targets,
    minify: false,
    drafts: {
      nesting: true,
      customMedia: true,
    },
  });
  return { content: String(code), sourcemap: map };
};

// runtimeCompat names on the left, lightningcss target names on the right
// (https://lightningcss.dev/transpilation.html#targets)
const LIGHTNINGCSS_TARGET_NAMES = {
  chrome: "chrome",
  firefox: "firefox",
  ie: "ie",
  ios_safari: "ios_saf",
  opera: "opera",
  safari: "safari",
};

const runtimeCompatToTargets = (runtimeCompat) => {
  const targets = {};
  Object.keys(LIGHTNINGCSS_TARGET_NAMES).forEach((runtimeName) => {
    const version = runtimeCompat[runtimeName];
    if (version) {
      targets[LIGHTNINGCSS_TARGET_NAMES[runtimeName]] = versionToBits(version);
    }
  });
  return targets;
};

const versionToBits = (version) => {
  const [major, minor = 0, patch = 0] = version
    .split("-")[0]
    .split(".")
    .map((v) => parseInt(v, 10));
  return (major << 16) | (minor << 8) | patch;
};
