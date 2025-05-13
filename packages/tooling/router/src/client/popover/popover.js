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
  box-shadow: 3px 4px 4px rgba(0, 0, 0, 0.2);
  position: relative;
  border-radius: 4px;
}

.popover_content {
  position: relative;
  padding: 5px;
}

.popover_svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: visible;
  pointer-events: none;
}

.popover_border {
  fill: white;
  stroke: red;
  stroke-width: 10px;
}
`;

const html = /* html */ `<style>
    ${css}
  </style>
  <div class="popover">
    <svg class="popover_svg" preserveAspectRatio="none">
      <path class="popover_border" d=""></path>
    </svg>
    <div class="popover_content">Default message</div>
  </div>`;

const strokeWidth = 10;
const arrowHeight = 6;
const arrowWidth = 10;

class JsenvPopover extends HTMLElement {
  constructor(innerHTML, { arrowDirection }) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = html;
    const popoverElement = root.querySelector(".popover");

    const content = popoverElement.querySelector(".popover_content");
    content.innerHTML = innerHTML;
    this.arrowDirection = arrowDirection;
  }

  connectedCallback() {
    const shadowRoot = this.shadowRoot;
    const popoverElement = shadowRoot.querySelector(".popover");
    const svg = popoverElement.querySelector(".popover_svg");
    const svgPath = popoverElement.querySelector(".popover_border");
    const arrowDirection = this.arrowDirection;

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

      // Make SVG slightly larger to accommodate the arrow
      const effectiveArrowSize = arrowWidth + strokeWidth;

      let viewBoxWidth = width;
      let viewBoxHeight = height;

      // Position SVG to extend beyond popover based on arrow position
      if (arrowDirection === "down") {
        // For arrow pointing down
        viewBoxHeight += effectiveArrowSize;
        svg.style.height = `${height + effectiveArrowSize}px`;
        svg.style.top = "0px";
      } else if (arrowDirection === "up") {
        // For arrow pointing up
        viewBoxHeight += arrowHeight;
        svg.style.height = `${height + arrowHeight}px`;
        svg.style.top = `-${arrowHeight}px`; // Move SVG up by arrowSize pixels
      }

      svg.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`);

      const radius = 4; // Border radius
      let path;

      if (arrowDirection === "up") {
        // Arrow pointing up
        const arrowMiddle = width / 2;

        path = `
          M ${radius} ${arrowHeight}
          H ${arrowMiddle - arrowWidth / 2}
          L ${arrowMiddle} 0
          L ${arrowMiddle + arrowWidth / 2} ${arrowHeight}
          H ${width - radius}
          Q ${width} ${arrowHeight}, ${width} ${arrowHeight + radius}
          V ${viewBoxHeight - radius}
          Q ${width} ${viewBoxHeight}, ${width - radius} ${viewBoxHeight}
          H ${radius}
          Q 0 ${viewBoxHeight}, 0 ${viewBoxHeight - radius}
          V ${arrowHeight + radius}
          Q 0 ${arrowHeight}, ${radius} ${arrowHeight}
          Z`;
      } else if (arrowDirection === "down") {
        // Arrow pointing down
        const arrowMiddle = width / 2;

        path = `
          M ${radius} 0
          H ${width - radius}
          Q ${width} 0, ${width} ${radius}
          V ${height - radius}
          Q ${width} ${height}, ${width - radius} ${height}
          H ${arrowMiddle + arrowWidth / 2}
          L ${arrowMiddle} ${viewBoxHeight}
          L ${arrowMiddle - arrowWidth / 2} ${height}
          H ${radius}
          Q 0 ${height}, 0 ${height - radius}
          V ${radius}
          Q 0 0, ${radius} 0
          Z`;
      }

      svgPath.setAttribute("d", path);
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
  { position = "bottom", topSpacing = 0 } = {},
) => {
  const options = {
    root: null, // viewport
    rootMargin: "0px",
    threshold: [0, 0.25, 0.5, 0.75, 1], // Observer à différents niveaux de visibilité
  };

  const updatePosition = () => {
    const elementRect = elementToFollow.getBoundingClientRect();

    // For bottom position (arrow points up to the input)
    if (position === "bottom") {
      element.style.position = "absolute";
      // Position the popover so the arrow tip exactly touches the bottom of input
      // This is arrowSize pixels above where the main popover body starts
      element.style.top = `${elementRect.bottom + topSpacing}px`;
      element.style.left = `${elementRect.left + elementRect.width / 2}px`;
      element.style.transform = "translateX(-50%)";
    }
    // For top position (arrow points down to the input)
    else if (position === "top") {
      element.style.position = "absolute";
      element.style.bottom = `${window.innerHeight - elementRect.top}px`;
      element.style.left = `${elementRect.left + elementRect.width / 2}px`;
      element.style.transform = "translateX(-50%)";
    }
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      // Si l'élément cible est visible
      if (entry.isIntersecting) {
        // Mettre à jour la position du tooltip
        requestAnimationFrame(updatePosition);

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

  updatePosition();
  let rafId = null;
  const resizeObserver = new ResizeObserver(() => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(updatePosition);
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
  let arrowDirection;
  if (position === "bottom") {
    arrowDirection = "up"; // Arrow points up when popover is below the element
  } else if (position === "top") {
    arrowDirection = "down"; // Arrow points down when popover is above the element
  }
  const jsenvPopover = new JsenvPopover(innerHtml, { arrowDirection });
  document.body.appendChild(jsenvPopover);
  const stopFollowingPosition = followPosition(jsenvPopover, elementToFollow, {
    position,
    topSpacing: strokeWidth + arrowHeight / 2,
  });

  return () => {
    stopFollowingPosition();
    document.body.removeChild(jsenvPopover);
  };
};
