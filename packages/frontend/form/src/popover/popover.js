import { getScrollableParentSet } from "@jsenv/dom";

const css = /*css*/ `
.popover {
  display: block;
  overflow: visible;
  height: auto;
  position: fixed;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.popover_border {
  position: absolute;
  pointer-events: none;
}
.popover_border-top, .popover_border-bottom {
  display: none;
}

.popover_content_wrapper {
  border-style: solid;
  border-color: transparent;
  position: relative;
}
.popover_content {
  padding: 5px; 
  position: relative;
  border-radius: 3px;
}

.popover_border svg {
  position: absolute;
  inset: 0;
  overflow: visible;
  filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
}
`;

const styleElement = document.createElement("style");
styleElement.textContent = css;
document.head.appendChild(styleElement);

const arrowWidth = 16;
const arrowHeight = 8;
const radius = 3;
const borderWidth = 1;

const generateSvgWithTopArrow = (width, height, arrowPosition) => {
  // Ensure arrow position is within boundaries
  const minArrowPos = arrowWidth / 2 + radius;
  const maxArrowPos = width - arrowWidth / 2 - radius;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - arrowHeight;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + arrowHeight;

  // For small border widths (like 1px), we want the inner arrow to be almost the same size
  // For larger borders, we need a small adjustment to maintain visual balance
  const innerArrowWidthReduction = Math.min(borderWidth * 0.3, 1);

  // For rounded corners, create similar double-path structure
  // Outer path (border)
  const outerPath = `
      M${radius},${arrowHeight} 
      H${constrainedArrowPos - arrowWidth / 2} 
      L${constrainedArrowPos},0 
      L${constrainedArrowPos + arrowWidth / 2},${arrowHeight} 
      H${width - radius} 
      Q${width},${arrowHeight} ${width},${arrowHeight + radius} 
      V${adjustedHeight - radius} 
      Q${width},${adjustedHeight} ${width - radius},${adjustedHeight} 
      H${radius} 
      Q0,${adjustedHeight} 0,${adjustedHeight - radius} 
      V${arrowHeight + radius} 
      Q0,${arrowHeight} ${radius},${arrowHeight}
    `;

  // Inner path (content) - keep arrow width almost the same
  const innerRadius = Math.max(0, radius - borderWidth);
  const innerPath = `
    M${innerRadius + borderWidth},${arrowHeight + borderWidth} 
    H${constrainedArrowPos - arrowWidth / 2 + innerArrowWidthReduction} 
    L${constrainedArrowPos},${borderWidth} 
    L${constrainedArrowPos + arrowWidth / 2 - innerArrowWidthReduction},${arrowHeight + borderWidth} 
    H${width - innerRadius - borderWidth} 
    Q${width - borderWidth},${arrowHeight + borderWidth} ${width - borderWidth},${arrowHeight + innerRadius + borderWidth} 
    V${adjustedHeight - innerRadius - borderWidth} 
    Q${width - borderWidth},${adjustedHeight - borderWidth} ${width - innerRadius - borderWidth},${adjustedHeight - borderWidth} 
    H${innerRadius + borderWidth} 
    Q${borderWidth},${adjustedHeight - borderWidth} ${borderWidth},${adjustedHeight - innerRadius - borderWidth} 
    V${arrowHeight + innerRadius + borderWidth} 
    Q${borderWidth},${arrowHeight + borderWidth} ${innerRadius + borderWidth},${arrowHeight + borderWidth}
  `;

  return `<svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="${outerPath}" fill="#333" />
      <path d="${innerPath}" fill="white" />
    </svg>`;
};

const generateSvgWithBottomArrow = (width, height, arrowPosition) => {
  // Ensure arrow position is within boundaries
  const minArrowPos = arrowWidth / 2 + radius;
  const maxArrowPos = width - arrowWidth / 2 - radius;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - arrowHeight;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + arrowHeight;

  // For small border widths, keep inner arrow nearly the same size as outer
  const innerArrowWidthReduction = Math.min(borderWidth * 0.3, 1);

  // For rounded corners, create similar double-path structure
  const outerPath = `
      M${radius},0 
      H${width - radius} 
      Q${width},0 ${width},${radius} 
      V${contentHeight - radius} 
      Q${width},${contentHeight} ${width - radius},${contentHeight} 
      H${constrainedArrowPos + arrowWidth / 2} 
      L${constrainedArrowPos},${adjustedHeight} 
      L${constrainedArrowPos - arrowWidth / 2},${contentHeight} 
      H${radius} 
      Q0,${contentHeight} 0,${contentHeight - radius} 
      V${radius} 
      Q0,0 ${radius},0
    `;

  // Fixed inner path with correct arrow direction and color
  const innerRadius = Math.max(0, radius - borderWidth);
  const innerPath = `
    M${innerRadius + borderWidth},${borderWidth} 
    H${width - innerRadius - borderWidth} 
    Q${width - borderWidth},${borderWidth} ${width - borderWidth},${innerRadius + borderWidth} 
    V${contentHeight - innerRadius - borderWidth} 
    Q${width - borderWidth},${contentHeight - borderWidth} ${width - innerRadius - borderWidth},${contentHeight - borderWidth} 
    H${constrainedArrowPos + arrowWidth / 2 - innerArrowWidthReduction} 
    L${constrainedArrowPos},${adjustedHeight - borderWidth} 
    L${constrainedArrowPos - arrowWidth / 2 + innerArrowWidthReduction},${contentHeight - borderWidth} 
    H${innerRadius + borderWidth} 
    Q${borderWidth},${contentHeight - borderWidth} ${borderWidth},${contentHeight - innerRadius - borderWidth} 
    V${innerRadius + borderWidth} 
    Q${borderWidth},${borderWidth} ${innerRadius + borderWidth},${borderWidth}
  `;

  return `<svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="${outerPath}" fill="#333" />
      <path d="${innerPath}" fill="white" />
    </svg>`;
};

const html = /* html */ `
  <div class="popover">
    <div class="popover_content_wrapper">
      <div class="popover_border"></div>
      <div class="popover_content">Default message</div>
    </div>
  </div>
`;

const createPopover = (content) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  const popover = div.querySelector(".popover");
  const contentElement = popover.querySelector(".popover_content");
  contentElement.innerHTML = content;
  return popover;
};

const followPosition = (element, elementToFollow) => {
  const cleanupCallbackSet = new Set();
  const stop = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const popoverContentWrapper = element.querySelector(
    ".popover_content_wrapper",
  );
  const popoverBorder = element.querySelector(".popover_border");
  const popoverContent = element.querySelector(".popover_content");

  popoverContentWrapper.style.borderWidth = `${borderWidth}px`;
  popoverBorder.style.bottom = `-${borderWidth}px`;
  popoverBorder.style.left = `-${borderWidth}px`;
  popoverBorder.style.right = `-${borderWidth}px`;

  const updatePosition = () => {
    const elementRect = elementToFollow.getBoundingClientRect();

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    const contentWidth = popoverContent.offsetWidth;
    const contentHeight = popoverContent.offsetHeight;
    const margin = 10; // Marge de sécurité réduite pour être plus précis

    // Calculate the ideal horizontal position (centered)
    let leftPos = elementRect.left + elementRect.width / 2;
    const halfContentWidth = contentWidth / 2;

    // Step 1: Calculate popover position (constrained by viewport if needed)
    // Ajuster les limites pour tenir compte des bordures
    if (leftPos - halfContentWidth - borderWidth < 0) {
      // Contrainte sur le bord gauche (avec bordure)
      leftPos = halfContentWidth + borderWidth;
    } else if (leftPos + halfContentWidth + borderWidth > viewportWidth) {
      // Contrainte sur le bord droit (avec bordure)
      leftPos = viewportWidth - halfContentWidth - borderWidth;
    }

    // Step 2: Calculate where the arrow should point
    const targetLeftEdge = elementRect.left + 10; // 10px from left edge of target
    const popoverLeft = leftPos - halfContentWidth;
    let arrowPos = targetLeftEdge - popoverLeft;

    // Step 3: Constrain arrow position within valid bounds
    const minArrowPos = arrowWidth / 2 + radius + 7 + borderWidth / 2;
    const maxArrowPos = contentWidth - minArrowPos;
    arrowPos = Math.max(minArrowPos, Math.min(arrowPos, maxArrowPos));

    const popoverBorderRect = popoverBorder.getBoundingClientRect();

    // Calcul exact de l'espace disponible en dessous et au-dessus de l'élément
    const spaceBelow = viewportHeight - elementRect.bottom - margin;
    const spaceAbove = elementRect.top - margin;

    // Hauteur totale nécessaire pour le popover, en prenant en compte les bordures et la flèche
    const totalPopoverHeight = contentHeight + arrowHeight + borderWidth * 2;

    // Vérification pixel-perfect : est-ce que le popover tient en-dessous ?
    const fitsBelow = spaceBelow >= totalPopoverHeight;
    // Si ça ne tient pas en-dessous, est-ce que ça tient au-dessus ?
    const fitsAbove = spaceAbove >= totalPopoverHeight;

    // Décision basée sur l'espace disponible
    const showAbove = !fitsBelow && fitsAbove;
    // Si ça ne tient ni en-dessous ni au-dessus, on privilégie en-dessous (comportement par défaut)

    if (showAbove) {
      // Positionnement au-dessus
      element.setAttribute("data-position", "above");
      element.style.top = `${Math.max(margin, elementRect.top - totalPopoverHeight)}px`;
      popoverContentWrapper.style.marginTop = undefined;
      popoverContentWrapper.style.marginBottom = `${arrowHeight}px`;
      popoverBorder.style.top = `-${borderWidth}px`;
      popoverBorder.style.bottom = `-${borderWidth + arrowHeight}px`;
      popoverBorder.innerHTML = generateSvgWithBottomArrow(
        popoverBorderRect.width,
        popoverBorderRect.height,
        arrowPos,
      );
    } else {
      // Positionnement en-dessous (même si ça déborde, c'est mieux que rien)
      element.setAttribute("data-position", "below");
      element.style.top = `${elementRect.bottom}px`;
      popoverContentWrapper.style.marginTop = `${arrowHeight}px`;
      popoverContentWrapper.style.marginBottom = undefined;
      popoverBorder.style.top = `-${borderWidth + arrowHeight}px`;
      popoverBorder.style.bottom = `-${borderWidth}px`;
      popoverBorder.innerHTML = generateSvgWithTopArrow(
        popoverBorderRect.width,
        popoverBorderRect.height,
        arrowPos,
      );

      // Si le popover va dépasser le bas de l'écran, essayons de le limiter
      if (!fitsBelow && !fitsAbove) {
        // Solution de secours: limiter la hauteur du popover à l'espace disponible
        const availableHeight =
          viewportHeight -
          elementRect.bottom -
          arrowHeight -
          borderWidth * 2 -
          margin;
        if (availableHeight > 50) {
          // Seulement si on a un minimum d'espace pour afficher quelque chose d'utile
          popoverContent.style.maxHeight = `${availableHeight}px`;
          popoverContent.style.overflowY = "auto";
        }
      }
    }

    // Position the popover
    element.style.left = `${leftPos}px`;
    element.style.transform = "translateX(-50%)";
  };

  // Initial position calculation
  updatePosition();

  let rafId = null;
  const schedulePositionUpdate = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updatePosition);
  };
  cleanupCallbackSet.add(() => {
    cancelAnimationFrame(rafId);
  });

  update_on_content_change: {
    const resizeObserverContent = new ResizeObserver(() => {
      schedulePositionUpdate();
    });
    resizeObserverContent.observe(popoverContent);
    cleanupCallbackSet.add(() => {
      resizeObserverContent.disconnect();
    });
  }

  update_on_target_visibility_change: {
    const options = {
      root: null,
      rootMargin: "0px",
      threshold: [0, 1],
    };
    const intersectionObserver = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        element.style.opacity = 1;
        schedulePositionUpdate();
      } else {
        element.style.opacity = 0;
      }
    }, options);
    intersectionObserver.observe(elementToFollow);
    cleanupCallbackSet.add(() => {
      intersectionObserver.disconnect();
    });
  }

  update_on_scroll: {
    const handleScroll = () => {
      schedulePositionUpdate();
    };

    const scrollableParentSet = getScrollableParentSet(elementToFollow);
    for (const scrollableParent of scrollableParentSet) {
      scrollableParent.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      cleanupCallbackSet.add(() => {
        scrollableParent.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }
  }

  update_on_target_size_change: {
    const resizeObserver = new ResizeObserver(() => {
      schedulePositionUpdate();
    });
    resizeObserver.observe(elementToFollow);
    cleanupCallbackSet.add(() => {
      resizeObserver.unobserve(elementToFollow);
    });
  }

  return stop;
};

export const showPopover = (elementToFollow, innerHtml) => {
  const jsenvPopover = createPopover(innerHtml);
  jsenvPopover.style.opacity = "0";
  document.body.appendChild(jsenvPopover);
  const stopFollowingPosition = followPosition(jsenvPopover, elementToFollow);

  return () => {
    stopFollowingPosition();
    if (document.body.contains(jsenvPopover)) {
      document.body.removeChild(jsenvPopover);
    }
  };
};
