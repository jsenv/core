/**
 * The colour the browser paints around the page — Chrome's address bar on
 * Android, the status bar of an installed app — read from
 * `<meta name="theme-color">`. It sits right above the page's top edge, so it
 * reads as part of whatever is drawn there, and two layers decide it:
 *
 * - What the page asks for: the theme-color metas a `<Head>` brings. The last
 *   Head to arrive wins, whatever order they leave in — the title's rule, for
 *   the title's reason (see head.jsx).
 * - What the top layer lays over that edge: an open popup paints its backdrop
 *   over what is under it, and its own surface too when it is flush with the
 *   top edge. Popups sit above every Head, in opening order, and are painted
 *   again from what is under them each time it changes — a page changing
 *   under an open popup is dimmed by it all the same.
 *
 * The browser reads the first theme-color meta whose `media` matches, in tree
 * order: a Head appending its meta after an earlier one would never be read.
 * So navi writes the result into metas of its own placed before any other, and
 * a meta written in the HTML is the bottom of the stack. A popup paints over
 * every meta of the list, `media` kept, so whichever one the browser picks is
 * the one it would have picked, painted over.
 */

const headEntries = [];
const popupLayers = [];
const ownMetas = [];

/**
 * @param {Array<{ content: string, media: string|null }>} themeColors
 * @returns {() => void} Takes them away.
 */
export const pushHeadThemeColors = (themeColors) => {
  headEntries.push(themeColors);
  queueRender();
  return () => {
    headEntries.splice(headEntries.indexOf(themeColors), 1);
    queueRender();
  };
};

/**
 * @param {object} paint
 * @param {string} [paint.themeColor] - Forces the colour, nothing is painted.
 * @param {string|null} [paint.backdropColor] - Laid over the page's colour.
 * @param {string|null} [paint.surfaceColor] - Laid over that, for a popup
 *   flush with the top edge.
 * @returns {() => void} Takes the layer away.
 */
export const pushPopupThemeColor = ({
  themeColor,
  backdropColor,
  surfaceColor,
}) => {
  let layer;
  if (themeColor) {
    layer = { color: themeColor };
  } else {
    const paints = [];
    for (const color of [backdropColor, surfaceColor]) {
      if (!color) {
        continue;
      }
      const rgba = parseColor(color);
      if (rgba[3] > 0) {
        paints.push(rgba);
      }
    }
    // Nothing laid over the edge: the colour under it stays, as it is.
    if (paints.length === 0) {
      return () => {};
    }
    layer = { paints };
  }
  popupLayers.push(layer);
  queueRender();
  return () => {
    popupLayers.splice(popupLayers.indexOf(layer), 1);
    queueRender();
  };
};

let renderQueued = false;
// Once per commit: a Head re-rendering leaves and arrives again in the same
// commit, and the browser must not be handed the colour from in between.
const queueRender = () => {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  queueMicrotask(render);
};

const render = () => {
  renderQueued = false;
  const htmlMetas = Array.from(
    document.head.querySelectorAll('meta[name="theme-color"]'),
  ).filter((meta) => !ownMetas.includes(meta));
  const htmlColors = htmlMetas.map((meta) => ({
    content: meta.getAttribute("content"),
    media: meta.getAttribute("media"),
  }));
  let colors = [];
  for (let i = headEntries.length - 1; i >= 0; i--) {
    colors.push(...headEntries[i]);
  }
  colors.push(...htmlColors);
  for (const layer of popupLayers) {
    colors = paintLayer(layer, colors);
  }
  // What the HTML metas say reaches the browser without a copy.
  while (colors.length > 0 && htmlColors.includes(colors[colors.length - 1])) {
    colors.pop();
  }

  while (ownMetas.length > colors.length) {
    ownMetas.pop().remove();
  }
  colors.forEach(({ content, media }, index) => {
    let meta = ownMetas[index];
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      const previousMeta = ownMetas[index - 1];
      if (previousMeta) {
        previousMeta.after(meta);
      } else if (htmlMetas.length > 0) {
        htmlMetas[0].before(meta);
      } else {
        document.head.append(meta);
      }
      ownMetas.push(meta);
    }
    if (meta.getAttribute("content") !== content) {
      meta.setAttribute("content", content);
    }
    if (meta.getAttribute("media") !== media) {
      if (media === null) {
        meta.removeAttribute("media");
      } else {
        meta.setAttribute("media", media);
      }
    }
  });
};

const paintLayer = (layer, colors) => {
  if (layer.color) {
    return [{ content: layer.color, media: null }];
  }
  const underColors =
    colors.length > 0 ? colors : [{ content: null, media: null }];
  const painted = [];
  for (const { content, media } of underColors) {
    let rgba = content === null ? null : parseUnderColor(content);
    for (const paint of layer.paints) {
      rgba = rgba ? composite(paint, rgba) : paint;
    }
    // Over no colour at all the browser keeps one of its own, which a
    // translucent paint cannot be laid over.
    if (Math.round(rgba[3] * 255) === 255) {
      painted.push({ content: toHex(rgba), media });
    }
  }
  return painted;
};

// The browser shows a theme-color opaque, whatever alpha it was written with.
const parseUnderColor = (color) => {
  const rgba = parseColor(color);
  if (rgba[3] === 0) {
    return null;
  }
  return [rgba[0], rgba[1], rgba[2], 1];
};

// Source-over, the way the backdrop is drawn over the page.
const composite = (over, under) => {
  const [r1, g1, b1, a1] = over;
  const [r2, g2, b2, a2] = under;
  const alpha = a1 + a2 * (1 - a1);
  const mix = (c1, c2) => (c1 * a1 + c2 * a2 * (1 - a1)) / alpha;
  return [mix(r1, r2), mix(g1, g2), mix(b1, b2), alpha];
};

const toHex = ([r, g, b]) =>
  `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;

// A canvas reads every colour syntax the browser knows — oklch(), color(),
// a keyword — and hands back sRGB bytes, which is what a theme-color meta is
// sure to be understood in, whatever getComputedStyle answered with.
let colorContext = null;
const parseColor = (color) => {
  if (!colorContext) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorContext = canvas.getContext("2d", { willReadFrequently: true });
  }
  colorContext.clearRect(0, 0, 1, 1);
  // fillStyle ignores a colour it cannot parse: reset first, so that one draws
  // nothing rather than the previous colour.
  colorContext.fillStyle = "transparent";
  colorContext.fillStyle = color;
  colorContext.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = colorContext.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
};
