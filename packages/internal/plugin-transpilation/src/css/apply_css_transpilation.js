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
  return {
    content: defineLightDarkSwitchIfNeeded(String(code)),
    sourcemap: map,
  };
};

// The two custom properties lightningcss lowers "light-dark()" into. The pair
// works as a switch: exactly one of them computes to the guaranteed-invalid
// "initial" at a time, so exactly one of the two var() fallbacks survives.
const LIGHT_DARK_SWITCH_CSS = `
:root {
  --lightningcss-light: initial;
  --lightningcss-dark: ;
}
@media (prefers-color-scheme: dark) {
  :root {
    --lightningcss-light: ;
    --lightningcss-dark: initial;
  }
}
`;

// lightningcss writes that switch into the rule declaring "color-scheme", and
// only there: a stylesheet lowering light-dark() without one references two
// properties nobody defines, both var() fall back, the two values concatenate
// and the declaration is dropped as invalid — a color silently missing rather
// than an approximation of it. Each module owning a stylesheet of its own (see
// jsenv:import_meta_css), the sheet declaring color-scheme is almost never the
// sheet using light-dark(), so the switch is written here instead. Appended
// rather than prepended: nothing else declares these two, so cascade order does
// not matter, and the sourcemap of what comes before stays exact.
const defineLightDarkSwitchIfNeeded = (css) => {
  if (!css.includes("var(--lightningcss-light")) {
    return css;
  }
  if (css.includes("--lightningcss-light:")) {
    return css;
  }
  return `${css}${LIGHT_DARK_SWITCH_CSS}`;
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
