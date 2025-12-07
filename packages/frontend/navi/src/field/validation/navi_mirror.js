export const createNaviMirror = (sourceElement) => {
  const naviMirror = new NaviMirror(sourceElement);
  return naviMirror;
};

// Custom element that mirrors another element's content
class NaviMirror extends HTMLElement {
  constructor(sourceElement) {
    super();
    this.sourceElement = null;
    this.sourceObserver = null;
    this.setSourceElement(sourceElement);
  }

  setSourceElement(sourceElement) {
    this.sourceElement = sourceElement;
    this.updateFromSource();
  }

  updateFromSource() {
    if (!this.sourceElement) return;

    this.innerHTML = this.sourceElement.innerHTML;
    // Copy attributes from source (except id to avoid conflicts)
    for (const attr of Array.from(this.sourceElement.attributes)) {
      if (attr.name !== "id") {
        this.setAttribute(attr.name, attr.value);
      }
    }
  }

  startObserving() {
    if (this.sourceObserver || !this.sourceElement) return;
    this.sourceObserver = new MutationObserver(() => {
      this.updateFromSource();
    });
    this.sourceObserver.observe(this.sourceElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  stopObserving() {
    if (this.sourceObserver) {
      this.sourceObserver.disconnect();
      this.sourceObserver = null;
    }
  }

  // Called when element is added to DOM
  connectedCallback() {
    this.startObserving();
  }

  // Called when element is removed from DOM
  disconnectedCallback() {
    this.stopObserving();
  }
}

// Register the custom element if not already registered
if (!customElements.get("navi-mirror")) {
  customElements.define("navi-mirror", NaviMirror);
}
