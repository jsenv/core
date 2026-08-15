/*
 * A ribbon marking a page as non-production: "DEV" while developing, whatever
 * the app wants otherwise ("preview", a version number, a branch name).
 *
 * Two shapes, picked by "position":
 * - a corner ("top-right", "top-left", "bottom-right", "bottom-left") draws the
 *   diagonal band clipped by a 100x100 square in that corner
 * - an edge ("top", "bottom") draws a full width horizontal band
 *
 * The container never captures pointer events; only the visible band does, and
 * only when "href" turns it into a link. A corner ribbon therefore costs the app
 * nothing: the rest of the 100x100 square keeps letting clicks through to the
 * interface underneath, which usually lives exactly there.
 */

const CORNER_POSITIONS = {
  "top-right": {
    placement: `top: 0; right: 0;`,
    transform: `translate(26px, -26px) rotate(45deg)`,
  },
  "top-left": {
    placement: `top: 0; left: 0;`,
    transform: `translate(-26px, -26px) rotate(-45deg)`,
  },
  "bottom-right": {
    placement: `bottom: 0; right: 0;`,
    transform: `translate(26px, 26px) rotate(-45deg)`,
  },
  "bottom-left": {
    placement: `bottom: 0; left: 0;`,
    transform: `translate(-26px, 26px) rotate(45deg)`,
  },
};
const EDGE_POSITIONS = {
  top: `top: 0; left: 0; right: 0;`,
  bottom: `bottom: 0; left: 0; right: 0;`,
};
const DARK_TEXT_COLOR = "rgb(55, 7, 7)";
const LIGHT_TEXT_COLOR = "rgb(255, 255, 255)";

const injectRibbon = ({
  text = "DEV",
  color = "orange",
  textColor,
  href,
  target = "_blank",
  position = "top-right",
}) => {
  if (!CORNER_POSITIONS[position] && !EDGE_POSITIONS[position]) {
    console.warn(
      `unknown ribbon position "${position}", falling back to "top-right"`,
    );
    position = "top-right";
  }
  if (textColor === undefined) {
    textColor = pickTextColorFor(color);
  }
  const corner = CORNER_POSITIONS[position];
  const css = /* css */ `
    #jsenv_ribbon_container {
      position: fixed;
      z-index: 1001;
      pointer-events: none;
      overflow: hidden;
      ${corner
        ? `width: 100px; height: 100px; ${corner.placement}`
        : EDGE_POSITIONS[position]}
    }
    #jsenv_ribbon_text {
      display: block;
      color: ${textColor};
      font-weight: 700;
      font-size: 16px;
      font-family: "Lato", sans-serif;
      text-align: center;
      text-decoration: none;
      text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
      background-color: ${color};
      box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
      opacity: 0.8;
      transition: opacity 150ms ease;
      user-select: none;
      ${corner
        ? `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 150px;
      margin-top: -18px;
      margin-left: -75px;
      line-height: 36px;
      transform: ${corner.transform};`
        : `
      position: relative;
      width: 100%;
      line-height: 28px;`}
    }
    /* A ribbon without href never receives pointer events, so it stays at 0.8:
       covering enough to be read in one go, transparent enough to guess what is
       underneath */
    #jsenv_ribbon_text:hover,
    #jsenv_ribbon_text:focus-visible {
      opacity: 1;
    }
  `;
  const tagName = href ? "a" : "div";
  const linkAttributes = href
    ? ` href="${escapeHtmlAttributeValue(href)}" target="${escapeHtmlAttributeValue(target)}" rel="noopener noreferrer" style="pointer-events: auto;"`
    : "";
  const html = /* html */ `<div id="jsenv_ribbon_container">
      <style>
        ${css}
      </style>
      <${tagName} id="jsenv_ribbon_text"${linkAttributes}>${text}</${tagName}>
    </div>`;
  class JsenvRibbonHtmlElement extends HTMLElement {
    constructor({ hidden }) {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = html;
      if (hidden) {
        root.style.display = "none";
      }
    }
  }
  if (customElements && !customElements.get("jsenv-ribbon")) {
    customElements.define("jsenv-ribbon", JsenvRibbonHtmlElement);
  }
  const toolbarStateInLocalStorage = localStorage.hasOwnProperty(
    "jsenv_toolbar",
  )
    ? JSON.parse(localStorage.getItem("jsenv_toolbar"))
    : {};
  const jsenvRibbonElement = new JsenvRibbonHtmlElement({
    hidden: toolbarStateInLocalStorage.ribbonDisplayed === false,
  });
  appendIntoRespectingLineBreaksAndIndentation(
    jsenvRibbonElement,
    document.body,
  );
};

// The browser is the only one knowing what "orange" or "oklch(...)" resolves to,
// so we let it resolve the color before deciding between dark and light text
const pickTextColorFor = (color) => {
  const probeElement = document.createElement("div");
  probeElement.style.color = color;
  document.body.appendChild(probeElement);
  const colorComputed = getComputedStyle(probeElement).color;
  probeElement.remove();
  const rgbMatch = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(
    colorComputed,
  );
  if (!rgbMatch) {
    return DARK_TEXT_COLOR;
  }
  const r = parseFloat(rgbMatch[1]);
  const g = parseFloat(rgbMatch[2]);
  const b = parseFloat(rgbMatch[3]);
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (brightness > 0.55) {
    return DARK_TEXT_COLOR;
  }
  return LIGHT_TEXT_COLOR;
};

const escapeHtmlAttributeValue = (value) => {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
};

const appendIntoRespectingLineBreaksAndIndentation = (
  node,
  parentNode,
  { indent = 2 } = {},
) => {
  const indentMinusOne = "  ".repeat(indent - 1);
  const desiredIndent = "  ".repeat(indent);
  const previousSibling =
    parentNode.childNodes[parentNode.childNodes.length - 1];
  if (previousSibling && previousSibling.nodeName === "#text") {
    if (previousSibling.nodeValue === `\n${indentMinusOne}`) {
      previousSibling.nodeValue = `\n${desiredIndent}`;
    }
    if (previousSibling.nodeValue !== `\n${desiredIndent}`) {
      previousSibling.nodeValue = `\n${desiredIndent}`;
    }
  } else {
    parentNode.appendChild(document.createTextNode(`\n${desiredIndent}`));
  }
  parentNode.appendChild(node);
  parentNode.appendChild(document.createTextNode(`\n${indentMinusOne}`));
};

export { injectRibbon };
