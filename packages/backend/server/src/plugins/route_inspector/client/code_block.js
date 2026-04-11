/**
 * Example of how you'd use this:
 * <code-block data-language="HTML" data-escaped="true">
 *   <h1>Your HTML here. Any HTML should be escaped</h1>
 * </code-block>
 *
 * https://github.com/TheWebTech/hs-code-block-web-component/tree/main
 */

(() => {
  const css = /* css */ `
    *[aria-hidden="true"] {
      display: none;
    }

    .clipboard_container {
      display: flex;
      padding: 8px;
      align-items: center;
      gap: 5px;
    }

    #copied_notif {
      padding: 0.2em 0.5em;
      color: white;
      font-size: 80%;
      background: black;
      border-radius: 3px;
    }

    button {
      width: 32px;
      height: 32px;
      background: none;
      background-color: rgb(246, 248, 250);
      border: none;
      border-width: 1px;
      border-style: solid;
      border-color: rgb(209, 217, 224);
      border-radius: 6px;
      cursor: pointer;
    }

    button:hover {
      background-color: rgb(239, 242, 245);
    }
  `;

  const html = /* html */ `<style>
      ${css}
    </style>
    <div class="clipboard_container">
      <div id="copied_notif" aria-hidden="true">Copied !</div>
      <button id="copy_button">
        <svg
          id="copy_icon"
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="16"
          height="16"
        >
          <path
            d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"
          ></path>
          <path
            d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
          ></path>
        </svg>
        <svg
          id="copied_icon"
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="16"
          height="16"
        >
          <path
            d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
          ></path>
        </svg>
      </button>
    </div>`;
  class ClipboardCopy extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = html;
    }

    connectedCallback() {
      const valueToCopy = this.getAttribute("value");
      const shadowRoot = this.shadowRoot;
      const button = shadowRoot.querySelector("button");
      const copyIcon = shadowRoot.querySelector("#copy_icon");
      const copiedIcon = shadowRoot.querySelector("#copied_icon");
      const copiedNotif = shadowRoot.querySelector("#copied_notif");
      copyIcon.removeAttribute("aria-hidden");

      const copy = async () => {
        await addToClipboard(valueToCopy);
        copiedNotif.removeAttribute("aria-hidden");
        copyIcon.setAttribute("aria-hidden", "true");
        copiedIcon.setAttribute("aria-hidden", "false");
        setTimeout(() => {
          copiedNotif.setAttribute("aria-hidden", "true");
          copyIcon.setAttribute("aria-hidden", "false");
          copiedIcon.setAttribute("aria-hidden", "true");
        }, 1500);
      };

      button.onclick = () => {
        copy();
      };
    }
  }

  customElements.define("clipboard-copy", ClipboardCopy);

  const addToClipboard = async (text) => {
    const type = "text/plain";
    const clipboardItemData = {
      [type]: text,
    };
    const clipboardItem = new ClipboardItem(clipboardItemData);
    await window.navigator.clipboard.write([clipboardItem]);
  };
})();

(() => {
  const css = /* css */ `
    /* :host {
            display: block;
        }
        :host code[class*="language-"], :host pre[class*="language-"]{
            margin-top: 0;
        } */
    #code_block {
      position: relative;
    }

    #pre {
      margin-top: 16px;
      margin-right: 0;
      margin-bottom: 16px;
      margin-left: 0;
      padding: 16px;
      font-size: 86%;
      background: #333;
    }
  `;

  const html = /* html */ `<style>
      ${css}
    </style>
    <div id="code_block">
      <pre id="pre"><code></code></pre>
      <div
        id="clipboard_copy_container"
        style="position: absolute; right: 0; top: 0"
      >
        <clipboard-copy></clipboard-copy>
      </div>
    </div>
`;

  let loadPromise;
  const loadPrism = () => {
    if (loadPromise) {
      return loadPromise;
    }
    // https://prismjs.com/#basic-usage
    const scriptLoadPromise = new Promise((resolve, reject) => {
      window.Prism = window.Prism || {};
      window.Prism.manual = true;
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/prismjs";
      script.onload = () => {
        resolve(window.Prism);
      };
      script.onerror = (error) => {
        reject(error);
      };
      document.head.appendChild(script);
    });
    const cssInjectionPromise = (async () => {
      const prismCssUrl =
        "https://cdn.jsdelivr.net/npm/prismjs/themes/prism-tomorrow.css?inline";
      const response = await window.fetch(prismCssUrl, {
        method: "GET",
      });
      const cssText = await response.text();
      const cssStylesheet = new CSSStyleSheet({ baseUrl: prismCssUrl });
      cssStylesheet.replaceSync(cssText);
      return cssStylesheet;
    })();
    loadPromise = Promise.all([scriptLoadPromise, cssInjectionPromise]);
    return loadPromise;
  };

  class CodeBlock extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = html;
      loadPrism();
    }

    async connectedCallback() {
      const shadowRoot = this.shadowRoot;
      const language = this.getAttribute("lang").toLowerCase();
      const isEscaped = this.hasAttribute("data-escaped");
      const addCopyButton = this.hasAttribute("data-copy-button");
      let code = this.innerHTML.trimStart();
      this.innerHTML = "";

      const codeNode = shadowRoot.querySelector("code");
      codeNode.className = `language-${language}`;
      codeNode.textContent = isEscaped ? unescapeHTML(code) : code;
      if (addCopyButton) {
        const clipboardCopy = shadowRoot.querySelector("clipboard-copy");
        clipboardCopy.setAttribute(
          "value",
          isEscaped ? unescapeHTML(code) : code,
        );
      }
      const [Prism, prismCssStyleSheet] = await loadPrism();
      shadowRoot.adoptedStyleSheets.push(prismCssStyleSheet);
      Prism.highlightAllUnder(shadowRoot);
    }
  }
  customElements.define("code-block", CodeBlock);

  const escape = document.createElement("textarea");
  function unescapeHTML(html) {
    escape.innerHTML = html;
    return escape.textContent;
  }
})();
