/**
 * I'll re-implement a custom validity api
 * because the native one is not configurable enough:
 *
 * - REALLY PAINFUL can't tell if the message is displayed or not, nor remove it with escape or something
 * - ok but complex: have to listen many evens in all directions to decide wether it's time to display the message or not
 * - ok but sitll not great: have to hack setCustomValidity to hold many validation messages
 * - ok but might be great to have some form of control on the design: can't customize the message
 */

/*

comme un input on peut rien mettre dedans il faut que:

- le tooltip suive l'élément dans le dom
donc idéalement le mettre dans le meme parent ou etre capable de suivre s'il bouge (what about scroll?)

*/

// https://druids.datadoghq.com/components/dialogs/Popover#example19

const css = /*css*/ `
.popover {
  border: 1px solid rgb(69, 76, 84);
  border-radius: 4px;
  padding: 5px;
  background-color: white;
  box-shadow: 3px 4px 4px rgba(0, 0, 0, 0.2);
  position: relative;
}

.popover_content {
  position: relative;
  z-index: 1;
}

.popover_svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.popover_border {
  fill: none;
  stroke: red;
  stroke-width: 1px;
}
`;

const html = /* html */ `<style>
    ${css}
  </style>
  <div class="popover">
    <div class="popover_content">Default message</div>
    <svg class="popover_svg" preserveAspectRatio="none">
      <path class="popover_border" d=""></path>
    </svg>
  </div>`;

class JsenvPopover extends HTMLElement {
  constructor(innerHTML) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = html;
    const popoverElement = root.querySelector(".popover");

    const content = popoverElement.querySelector(".popover_content");
    content.innerHTML = innerHTML;
  }

  connectedCallback() {
    const shadowRoot = this.shadowRoot;
    const popoverElement = shadowRoot.querySelector(".popover");
    const svg = popoverElement.querySelector(".popover_svg");
    const svgPath = popoverElement.querySelector(".popover_border");

    let prevWidth = 0;
    let prevHeight = 0;
    const updateSvgPath = () => {
      const width = popoverElement.offsetWidth;
      const height = popoverElement.offsetHeight;
      // Only update if dimensions actually changed
      if (width === prevWidth && height === prevHeight) {
        return;
      }
      prevWidth = width;
      prevHeight = height;
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

      // Create path for rectangle with rounded corners to match the popover
      const radius = 4; // Same as border-radius in CSS
      svgPath.setAttribute(
        "d",
        `M ${radius} 0 
         H ${width - radius} 
         Q ${width} 0, ${width} ${radius} 
         V ${height - radius} 
         Q ${width} ${height}, ${width - radius} ${height} 
         H ${radius} 
         Q 0 ${height}, 0 ${height - radius} 
         V ${radius} 
         Q 0 0, ${radius} 0 
         Z`,
      );
    };

    requestAnimationFrame(() => {
      updateSvgPath();
    });

    let rafId = null;
    const resizeObserver = new ResizeObserver(() => {
      // Cancel any pending animation frame
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      // Schedule a new update on next animation frame
      rafId = requestAnimationFrame(updateSvgPath);
    });
    resizeObserver.observe(popoverElement);
    this.resizeObserver = resizeObserver;
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
  }
}
if (!customElements.get("jsenv-popover")) {
  customElements.define("jsenv-popover", JsenvPopover);
}

const followPosition = (
  element,
  elementToFollow,
  { position = "bottom" } = {},
) => {
  const options = {
    root: null, // viewport
    rootMargin: "0px",
    threshold: [0, 0.25, 0.5, 0.75, 1], // Observer à différents niveaux de visibilité
  };

  const updatePosition = () => {
    const elementRect = elementToFollow.getBoundingClientRect();
    if (position === "top") {
      element.style.position = "absolute";
      element.style.bottom = `${window.innerHeight - elementRect.top + 10}px`;
      element.style.left = `${elementRect.left + elementRect.width / 2}px`;
      element.style.transform = "translateX(-50%)";
    }
    if (position === "bottom") {
      element.style.position = "absolute";
      element.style.top = `${elementRect.bottom + 10}px`;
      element.style.left = `${elementRect.left + elementRect.width / 2}px`;
      element.style.transform = "translateX(-50%)";
    }
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      // Si l'élément cible est visible
      if (entry.isIntersecting) {
        // Mettre à jour la position du tooltip
        updatePosition();

        // Vous pouvez aussi ajuster la visibilité en fonction du ratio
        const visibilityRatio = entry.intersectionRatio;
        element.style.opacity = visibilityRatio;
        // Enregistrer les détails de position
      } else {
        // L'élément n'est pas visible, masquer le tooltip ou le déplacer
        element.style.opacity = "0";
      }
    }
  }, options);

  const resizeObserver = new ResizeObserver(() => {
    updatePosition();
  });
  resizeObserver.observe(elementToFollow);

  return () => {
    observer.disconnect();
    resizeObserver.disconnect();
  };
};

export const showPopover = (
  elementToFollow,
  innerHtml,
  { position = "bottom" } = {},
) => {
  const jsenvPopover = new JsenvPopover(innerHtml);
  document.body.appendChild(jsenvPopover);
  const stopFollowingPosition = followPosition(jsenvPopover, elementToFollow, {
    position,
  });

  return () => {
    stopFollowingPosition();
    document.body.removeChild(jsenvPopover);
  };
};
