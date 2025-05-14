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
  display: block;
  overflow: visible;
  height: auto;
  position: relative;
}

.popover_content {
  position: relative;
  padding: 5px;
  border: 10px solid black;
  background: white;
}
`;

const html = /* html */ `
  <div class="popover">
    <style>
      ${css}
    </style>
    <div class="popover_content">Default message</div>
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
  const options = {
    root: null, // viewport
    rootMargin: "0px",
    threshold: [0, 0.25, 0.5, 0.75, 1], // Observer à différents niveaux de visibilité
  };

  const updatePosition = () => {
    const elementRect = elementToFollow.getBoundingClientRect();
    element.style.position = "fixed";
    // Position the popover so the arrow tip exactly touches the bottom of input
    // This is arrowSize pixels above where the main popover body starts
    element.style.top = `${elementRect.bottom}px`;
    element.style.left = `${elementRect.left + elementRect.width / 2}px`;
    element.style.transform = "translateX(-50%)";
  };
  const intersectionObserver = new IntersectionObserver((entries) => {
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
  updatePosition();
  intersectionObserver.observe(elementToFollow);

  let rafId = null;
  const resizeObserver = new ResizeObserver(() => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(updatePosition);
  });
  resizeObserver.observe(elementToFollow);

  return () => {
    intersectionObserver.disconnect();
    resizeObserver.disconnect();
  };
};

export const showPopover = (elementToFollow, innerHtml) => {
  const jsenvPopover = createPopover(innerHtml);
  const stopFollowingPosition = followPosition(jsenvPopover, elementToFollow);
  document.body.appendChild(jsenvPopover);

  const popoverRect = jsenvPopover.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  if (popoverRect.bottom > viewportHeight) {
    // Calculate how much we need to scroll to show the popover
    // without affecting its position relative to the element
    const scrollAmount = popoverRect.bottom - viewportHeight + 20; // Add 20px padding
    // Smoothly scroll just enough to show the popover
    window.scrollBy({
      top: scrollAmount,
      behavior: "smooth",
    });
  }

  return () => {
    stopFollowingPosition();
    document.body.removeChild(jsenvPopover);
  };
};
