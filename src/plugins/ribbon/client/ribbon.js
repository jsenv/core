export const injectRibbon = ({ text }) => {
  const css = /* css */ `
      #jsenv_ribbon_container {
        position: fixed;
        z-index: 1001;
        top: 0;
        right: 0;
        width: 100px;
        height: 100px;
        overflow: hidden;
        opacity: 0.5;
        pointer-events: none;
      }
      #jsenv_ribbon {
        position: absolute;
        top: -10px;
        right: -10px;
        width: 100%;
        height: 100%;
      }
      #jsenv_ribbon_text {
        position: absolute;
        left: 0px;
        top: 20px;
        transform: rotate(45deg);
        display: block;
        width: 125px;
        line-height: 36px;
        background-color: orange;
        color: rgb(55, 7, 7);
        box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
        font-weight: 700;
        font-size: 16px;
        font-family: "Lato", sans-serif;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
        text-align: center;
        user-select: none;
      }`;
  const html = /* html */ `<div id="jsenv_ribbon_container">
      <style>${css}</style>
      <div id="jsenv_ribbon">
        <div id="jsenv_ribbon_text">${text}</div>
      </div>
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
