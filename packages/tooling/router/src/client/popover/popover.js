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
  fill: white;
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
  constructor(innerHTML, { position }) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = html;
    const popoverElement = root.querySelector(".popover");

    const content = popoverElement.querySelector(".popover_content");
    content.innerHTML = innerHTML;
    this.position = position;
  }

  connectedCallback() {
    const shadowRoot = this.shadowRoot;
    const popoverElement = shadowRoot.querySelector(".popover");
    const svg = popoverElement.querySelector(".popover_svg");
    const svgPath = popoverElement.querySelector(".popover_border");
    const position = this.position;

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
      const arrowSize = 8;
      let viewBoxWidth = width;
      let viewBoxHeight = height;
      let translateX = 0;
      let translateY = 0;

      if (position === "bottom") {
        viewBoxHeight += arrowSize;
        translateY = arrowSize;
      } else if (position === "top") {
        viewBoxHeight += arrowSize;
      }

      svg.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
      svg.style.transform = `translate(${translateX}px, ${-translateY}px)`;

      const radius = 4; // Border radius
      let path;

      if (position === "bottom") {
        // Arrow pointing down
        const arrowMiddle = width / 2;
        const arrowWidth = 10;

        path = `
          M ${radius} ${arrowSize}
          H ${arrowMiddle - arrowWidth / 2}
          L ${arrowMiddle} ${viewBoxHeight}
          L ${arrowMiddle + arrowWidth / 2} ${arrowSize}
          H ${width - radius}
          Q ${width} ${arrowSize}, ${width} ${arrowSize + radius}
          V ${viewBoxHeight - radius - arrowSize}
          Q ${width} ${viewBoxHeight - arrowSize}, ${width - radius} ${viewBoxHeight - arrowSize}
          H ${radius}
          Q 0 ${viewBoxHeight - arrowSize}, 0 ${viewBoxHeight - radius - arrowSize}
          V ${arrowSize + radius}
          Q 0 ${arrowSize}, ${radius} ${arrowSize}
          Z`;
      } else if (position === "top") {
        // Arrow pointing up
        const arrowMiddle = width / 2;
        const arrowWidth = 10;

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
  { position = "bottom" } = {},
) => {
  const options = {
    root: null, // viewport
    rootMargin: "0px",
    threshold: [0, 0.25, 0.5, 0.75, 1], // Observer à différents niveaux de visibilité
  };

  const updatePosition = () => {
    const elementRect = elementToFollow.getBoundingClientRect();
    const arrowSize = 8; // Same as in the SVG path creation
    if (position === "top") {
      element.style.position = "absolute";
      element.style.bottom = `${window.innerHeight - elementRect.top + arrowSize}px`;
      element.style.left = `${elementRect.left + elementRect.width / 2}px`;
      element.style.transform = "translateX(-50%)";
    }
    if (position === "bottom") {
      element.style.position = "absolute";
      element.style.top = `${elementRect.bottom + arrowSize}px`;
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
  const jsenvPopover = new JsenvPopover(innerHtml, { position });
  document.body.appendChild(jsenvPopover);
  const stopFollowingPosition = followPosition(jsenvPopover, elementToFollow, {
    position,
  });

  return () => {
    stopFollowingPosition();
    document.body.removeChild(jsenvPopover);
  };
};
