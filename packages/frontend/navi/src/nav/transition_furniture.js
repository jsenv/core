/**
 * The furniture around the pages — the fixed bars, and the popups standing
 * over them in the top layer — photographed with them for the length of a
 * route transition, so that a piece of it belonging to ONE of the two states
 * takes part in the movement instead of appearing or vanishing in a frame.
 *
 * Whether a bar is the frame or part of what changes is a fact about the PAIR
 * of states, never about the bar: the top bar of a list is the frame while one
 * goes into a row of that list, and part of what changes when the next page
 * takes the whole screen. So nothing is declared — a name is written on every
 * bar for the length of the movement, and the browser derives the rest:
 *
 * - a bar the two states SHARE is one element wearing one name on both sides.
 *   The browser pairs the two pictures into one group and holds it where it
 *   stands: the frame, and the pages move behind it exactly as before.
 * - a bar only one state has never meets a counterpart. It belongs to the page
 *   that has it, so it travels with that page — leaving by the keyframes the
 *   page being left leaves by, arriving by the ones the page arriving arrives
 *   by — instead of going out with the render. Under the pages, so a page
 *   coming over it covers it — a popup over them instead, standing where it
 *   stands in the document (see the z-order in route_transition.jsx).
 *
 * A popup shown in the top layer is furniture of the same kind, and its case
 * is the sharper one: it is a DOM descendant of the area, yet painted outside
 * the area's picture, so being captured on its own is the only way it is on
 * screen at all for those few hundred milliseconds (layout/popup_css.js). One
 * the two states share holds where it stands, one only a single state has
 * travels with that state's page — the same two outcomes, derived the same way.
 *
 * Which keyframes those are is published by the movement itself
 * (--navi-route-transition-leave / -enter, see route_transition.jsx): a
 * selector cannot say "the bars that have no counterpart" — the names are per
 * element, so there is nothing static to write — so the rule is written for
 * the length of the movement, over the names this one turned out to have.
 *
 * The name is per ELEMENT and kept for the element's whole life, which is what
 * makes "shared" mean shared: several bars can live on one edge
 * (layout/fixed_bar/fixed_bar_space.js), so a bar leaving and another one
 * arriving on that same edge are two names and two movements, not one bar
 * changing its mind.
 *
 * Worn only while a transition of navi's plays: named the rest of the time, a
 * bar would be captured during every view transition the APPLICATION starts —
 * dead to the pointer and drawn in the top layer for the length of a movement
 * that has nothing to do with it. Being unable to answer a press is the price
 * of being photographed, and a route transition is where it costs nothing:
 * both pages are pictures for those few hundred milliseconds anyway.
 *
 * The WALL of a popup goes the other way round: it is not photographed at
 * all. The top layer is drawn during a transition only as part of the root's
 * picture, which is opted out while an area is marked (route_transition.jsx),
 * and a modal dialog's wall is its ::backdrop — a pseudo-element, which wears
 * no name; a popover's is a real element, but named it would be a picture the
 * size of the screen, sliding across the page arriving. Captured on its own,
 * the popup's box travels; its wall is painted nowhere for the length of the
 * movement, and the page under it leaves undimmed. So the wall is painted
 * INTO the page's picture instead: a stand-in laid over the area before each
 * of the two pictures is taken, painting what the wall paints, and removed
 * with the movement. Carried by the page's picture, it leaves with the page
 * being left and arrives with the page arriving, cut at the page's edge — and
 * under the popup's own picture, which stands over the pages (the z-order in
 * route_transition.jsx). The bars are under the wall as much as the page is,
 * and each is a picture of its own: the same stand-in is laid over every bar
 * outside the area. A bar the two states share is one group with two
 * pictures — dimmed on the side that has a wall — and its cross-fade is the
 * wall fading out as the page leaves, or in as it arrives; a bar only one
 * state has carries the wall with it. What no picture covers — the glass
 * beside a narrowed app, the window below a page shorter than it — shows the
 * live document through, and only the live document can paint a wall there:
 * one fixed stand-in over the window, under the pictures, with a hole cut
 * where each picture stands, its opacity taken from the state being left to
 * the state arriving on the movement's own clock. A popup with layer="local"
 * paints its wall inside the page and needs none of this.
 */

// The browser's top layer: painted above everything the document paints, so
// outside the area's picture whatever the DOM says.
const TOP_LAYER_SELECTOR = ":modal, :popover-open";
// What counts as furniture: what is pinned to an edge of the window and gives
// its room back to the content (layout/fixed_bar/fixed_bar.jsx), and what
// stands over the pages in the top layer. A sticky row inside the pages needs
// none of this — it lives in the area, so it is already part of the pages' own
// picture, and so is a popup rendered with layer="local".
const FURNITURE_SELECTOR = `.navi_fixed_bar, .navi_popover:is(${TOP_LAYER_SELECTOR}), .navi_dialog:is(${TOP_LAYER_SELECTOR})`;
// Worn by the root for the length of a route transition (route_transition.jsx
// owns it). Written out rather than imported: importing the module that owns
// it back into this one would close a cycle.
const TRANSITION_ATTRIBUTE = "data-navi-route-transition";
const NAME_PROPERTY = "view-transition-name";
export const FURNITURE_NAME_PREFIX = "navi-transition-furniture-";
// The walls painted in the top layer: a modal dialog's, which is its
// ::backdrop, and a popover's, which is a real element shown as a popover
// beside it (layout/popover.jsx) — unnamed, so covered by the pictures for
// the length of the movement all the same. A top-layer dialog without a wall
// is shown as a popover and has nothing to stand in for.
const TOP_LAYER_WALL_SELECTOR =
  ".navi_dialog:modal, .navi_popover_backdrop:popover-open";
const WALL_ATTRIBUTE = "data-navi-transition-wall";
// Worn by a bar both states have, from the hold on: its two pictures are one
// group, and the group is ordered over the pages (route_transition.jsx). Only
// a bar — a popup's class is written by layout/popup_css.js, and a second rule
// on the same property would replace it.
const SHARED_ATTRIBUTE = "data-navi-transition-furniture-shared";
// What the wall paints, resolved on the matched element in both cases (the
// dialog for its ::backdrop, the popover's wall for itself): the same two
// properties, copied onto the stand-in.
const WALL_PROPERTIES = ["--backdrop-background", "--backdrop-filter"];

// The pictures the wall is painted into: the pages', and every bar's own.
const FIXED_BAR_SELECTOR = ".navi_fixed_bar";

const TRANSITION_FURNITURE_CSS = /* css */ `
  /* Read by the browser at the second capture, which is where the group's
     class comes from when both states have the element. */
  .navi_fixed_bar[data-navi-transition-furniture-shared] {
    view-transition-class: navi_furniture_shared;
  }

  /* Laid over its target's rectangle from wherever its containing block turns
     out to be (see paintTransitionWalls), and above everything the target can
     paint: it stands for the top layer. Deaf to the pointer for the same
     reason the pictures are — the movement holds every press anyway
     (transition_press.js). */
  [data-navi-transition-wall] {
    position: absolute;
    top: 0;
    left: 0;
    z-index: var(--navi-z-index-top-layer);
    background: var(--backdrop-background);
    backdrop-filter: var(--backdrop-filter);
    pointer-events: none;

    /* Over the whole window, for what no picture covers; the holes are cut
       by paintRestWalls. Live DOM rather than a picture, so it fades by
       itself, on the pictures' clock and curve (the bars' own cross-fade is
       the browser's ease). */
    &[data-navi-transition-wall="rest"] {
      position: fixed;
      inset: 0;
      clip-path: var(--wall-holes);
      transition: opacity var(--navi-route-transition-duration, 300ms) ease;
    }
  }

  /* The last frame: the pictures are dropped and the live document paints
     again, with the stand-ins of the state arriving in it, so the holes are
     that state's rectangles — the ones a hole was cut for during the
     movement are where a picture stood at every moment, which is less. Said
     by the pseudo-class rather than by the finished callback, which runs a
     frame later; a browser without it shows that frame with the movement's
     holes. */
  :root:not(:active-view-transition) [data-navi-transition-wall="rest"] {
    clip-path: var(--wall-holes-arriving, var(--wall-holes));
  }

  /* The real wall is off for exactly as long as the stand-ins are up, so no
     frame ever shows both or neither. The frame the first picture is taken on
     is rendered and shown, with the top layer painted as usual: the real wall
     over the stand-in there is one frame twice as dark, read as a flash under
     the press. And the last frame goes the other way: the pictures are
     dropped, the top layer paints again, and the stand-ins are still there
     until the finished callback removes them, along with the attribute —
     one DOM write, one frame, and that frame is painted by the stand-ins
     alone, which paint what the wall paints. A wall's background is not one
     of its transitioned properties, so it goes and comes back at once.
     Scoped to navi's attribute: a view transition of the application's own
     keeps its walls. */
  :root[data-navi-route-transition] {
    .navi_dialog::backdrop,
    .navi_popover_backdrop {
      background: transparent;
      backdrop-filter: none;
    }
  }
`;

// Called as a movement starts over a marked area, never at module scope: a
// page that never travels between routes must not carry this sheet, and a
// build that sees no caller drops the css with the function.
export const installTransitionFurnitureCss = () => {
  import.meta.css = TRANSITION_FURNITURE_CSS;
};

const nameByElement = new WeakMap();
let nameCount = 0;

// Whose movement the names belong to, for the same reason the window has an
// owner (transition_window.js): a movement ending after another has replaced
// it must not strip what the new one is wearing.
let furnitureOwner = null;
let namedElements = new Set();
// The rule giving the one-sided bars their movement, written for one movement
// and taken down with it.
let travelStyleElement = null;
// The stand-ins for the walls open in the top layer, painted for one picture
// and taken down before the next.
let wallElements = [];
// The stand-ins for what no picture covers, kept for the whole movement, and
// the opacity they are heading to once it plays.
let restWallElements = [];
let restWallOpacity = "0";
// Where each picture stood in the state being left, by element: a hole in
// the rest walls is cut only where a picture stands at EVERY moment of the
// movement, which takes both states' rectangles.
let leavingRects = new Map();

/**
 * Name what stands around the area, before the picture of the state being left
 * is taken: the browser reads the names off the DOM as it stands when the
 * transition starts.
 */
export const nameTransitionFurniture = (owner, areaElement) => {
  if (owner !== furnitureOwner) {
    furnitureOwner = owner;
    namedElements = new Set();
  }
  nameFurnitureAround(areaElement);
  const sources = paintTransitionWalls(areaElement);
  // The state being left has walls: what no picture covers starts dimmed.
  // The frame the first picture is taken on shows the live document, so the
  // holes are this state's rectangles, stand-ins inside.
  removeRestWalls();
  leavingRects = measurePictureRects(areaElement);
  paintRestWalls(sources, "1");
  cutRestWalls([...leavingRects.values()]);
};

/**
 * The state arriving has rendered and the second picture has not been taken:
 * the one moment both states of the furniture are known. A bar that just
 * mounted is named — one that survived the render keeps the name it has, which
 * is what pairs its two pictures — and the bars only one of the two states has
 * are given the movement of the page they belong to.
 */
export const holdTransitionFurniture = (owner, areaElement) => {
  if (owner !== furnitureOwner) {
    return;
  }
  const namesLeaving = [];
  for (const element of namedElements) {
    if (!element.isConnected) {
      namesLeaving.push(nameByElement.get(element));
    } else if (element.matches(FIXED_BAR_SELECTOR)) {
      element.setAttribute(SHARED_ATTRIBUTE, "");
    }
  }
  const namesArriving = nameFurnitureAround(areaElement);
  const sources = paintTransitionWalls(areaElement);
  // The state arriving has walls: what no picture covers ends dimmed. Painted
  // from the state being left when that one had walls (they stay up if both
  // have), from the state arriving otherwise (they come up from nothing).
  restWallOpacity = sources.length > 0 ? "1" : "0";
  if (restWallElements.length === 0) {
    paintRestWalls(sources, "0");
  }
  // For the length of the movement a picture is only ever where the two
  // states' rectangles meet: the pages' pictures slide, and a taller page
  // arriving does not make the one leaving any taller. A picture only one
  // state has travels away from where it stood, so it gets no hole at all.
  const arrivingRects = measurePictureRects(areaElement);
  const holes = [];
  for (const [target, arrivingRect] of arrivingRects) {
    const leavingRect = leavingRects.get(target);
    if (!leavingRect) {
      continue;
    }
    const left =
      leavingRect.left > arrivingRect.left
        ? leavingRect.left
        : arrivingRect.left;
    const top =
      leavingRect.top > arrivingRect.top ? leavingRect.top : arrivingRect.top;
    const right =
      leavingRect.right < arrivingRect.right
        ? leavingRect.right
        : arrivingRect.right;
    const bottom =
      leavingRect.bottom < arrivingRect.bottom
        ? leavingRect.bottom
        : arrivingRect.bottom;
    if (right > left && bottom > top) {
      holes.push({ left, top, right, bottom });
    }
  }
  cutRestWalls(holes, [...arrivingRects.values()]);
  const cssText = `${travelRule("old", namesLeaving, "--navi-route-transition-leave")}${travelRule("new", namesArriving, "--navi-route-transition-enter")}`;
  if (!cssText) {
    return;
  }
  travelStyleElement = document.createElement("style");
  travelStyleElement.textContent = cssText;
  document.head.appendChild(travelStyleElement);
};

// Returns the elements it had to name, which are the ones the state arriving
// brought: everything else was already wearing its name from the first pass.
const nameFurnitureAround = (areaElement) => {
  const namesAdded = [];
  for (const element of document.querySelectorAll(FURNITURE_SELECTOR)) {
    if (namedElements.has(element)) {
      continue;
    }
    // Inside the area it is not furniture, it is the page: naming it would
    // punch a hole in the picture the movement is played on. Standing in the
    // top layer takes it out of that picture though, so there is no hole to
    // punch — which is exactly the case of a modal dialog rendered by a page.
    if (areaElement.contains(element) && !element.matches(TOP_LAYER_SELECTOR)) {
      continue;
    }
    let name = nameByElement.get(element);
    if (!name) {
      // A name the application wrote itself answers for that element, and it
      // is saying something navi is not: it wants that bar moved on the pages'
      // clock, by its own CSS. Asked only of a bar navi has never named — a
      // bar wearing one of ITS names is one this movement inherited from the
      // one it interrupted, and taking it for the application's would leave it
      // named for the rest of the document's life.
      if (getComputedStyle(element).viewTransitionName !== "none") {
        continue;
      }
      nameCount++;
      name = `${FURNITURE_NAME_PREFIX}${nameCount}`;
      nameByElement.set(element, name);
    }
    element.style.setProperty(NAME_PROPERTY, name);
    namedElements.add(element);
    namesAdded.push(name);
  }
  return namesAdded;
};

// The movement, played on pictures no static rule can name. The keyframes are
// read rather than guessed: a type navi ships publishes them, and so may one
// an application writes — a type that publishes nothing leaves its furniture
// to the browser's own fade, which is what the rule not being written means.
const travelRule = (side, names, movementProperty) => {
  if (names.length === 0) {
    return "";
  }
  const animationName = getComputedStyle(document.documentElement)
    .getPropertyValue(movementProperty)
    .trim();
  if (!animationName) {
    return "";
  }
  const selector = names
    .map(
      (name) =>
        `:root[${TRANSITION_ATTRIBUTE}]::view-transition-${side}(${name})`,
    )
    .join(",");
  return `${selector}{animation-name:${animationName};animation-timing-function:ease;animation-fill-mode:both}`;
};

/**
 * The pictures are up and about to move: what no picture covers heads to the
 * state arriving, on the same clock.
 */
export const startTransitionFurniture = (owner) => {
  if (owner !== furnitureOwner) {
    return;
  }
  for (const restWall of restWallElements) {
    restWall.style.opacity = restWallOpacity;
  }
};

export const releaseTransitionFurniture = (owner) => {
  if (owner !== furnitureOwner) {
    return;
  }
  furnitureOwner = null;
  for (const element of namedElements) {
    element.style.removeProperty(NAME_PROPERTY);
    element.removeAttribute(SHARED_ATTRIBUTE);
  }
  namedElements = new Set();
  if (travelStyleElement) {
    travelStyleElement.remove();
    travelStyleElement = null;
  }
  removeTransitionWalls();
  removeRestWalls();
};

// One stand-in per open wall in every picture, walls in document order: they
// stack in the top layer, and what dims the document is all of them. A wall
// open anywhere covers everything the document paints, so the sources are
// looked for in the whole document — a dialog opened from a bar dims the
// pages too. A bar inside the area is part of the pages' picture, and the
// area's stand-in answers for it.
const paintTransitionWalls = (areaElement) => {
  removeTransitionWalls();
  const sources = document.querySelectorAll(TOP_LAYER_WALL_SELECTOR);
  if (sources.length === 0) {
    return sources;
  }
  for (const target of pictureTargets(areaElement)) {
    for (const source of sources) {
      const wall = createWall(source);
      target.appendChild(wall);
      // The target is not necessarily a containing block (the area is a plain
      // box), and made one for the movement it would move whatever the page
      // positioned against an ancestor of it: the wall is placed from
      // wherever its containing block turns out to be, by the offset between
      // that box and the target's.
      const targetRect = pictureRect(target);
      const wallRect = wall.getBoundingClientRect();
      wall.style.left = `${targetRect.left - wallRect.left}px`;
      wall.style.top = `${targetRect.top - wallRect.top}px`;
      wall.style.width = `${targetRect.right - targetRect.left}px`;
      wall.style.height = `${targetRect.bottom - targetRect.top}px`;
      wallElements.push(wall);
    }
  }
  return sources;
};

const removeTransitionWalls = () => {
  for (const wall of wallElements) {
    wall.remove();
  }
  wallElements = [];
};

// What is photographed on its own and gets a stand-in in its picture: the
// pages, and every bar outside them.
const pictureTargets = (areaElement) => {
  const targets = [areaElement];
  for (const bar of document.querySelectorAll(FIXED_BAR_SELECTOR)) {
    if (!areaElement.contains(bar)) {
      targets.push(bar);
    }
  }
  return targets;
};

const createWall = (source) => {
  const sourceStyle = getComputedStyle(source);
  const wall = document.createElement("div");
  wall.setAttribute(WALL_ATTRIBUTE, "");
  for (const property of WALL_PROPERTIES) {
    wall.style.setProperty(property, sourceStyle.getPropertyValue(property));
  }
  return wall;
};

// One per open wall, over the window, at the opacity of the state they are
// painted from. A hole is cut where a picture stands, since the picture has
// a stand-in of its own and shows the live document through nowhere — and on
// the frames the live document IS shown, the first and the last, a hole is
// what keeps the two from being painted on top of each other.
const paintRestWalls = (sources, opacity) => {
  for (const source of sources) {
    const restWall = createWall(source);
    restWall.setAttribute(WALL_ATTRIBUTE, "rest");
    restWall.style.opacity = opacity;
    document.body.appendChild(restWall);
    restWallElements.push(restWall);
  }
};

const measurePictureRects = (areaElement) => {
  const rects = new Map();
  for (const target of pictureTargets(areaElement)) {
    rects.set(target, pictureRect(target));
  }
  return rects;
};

// What the picture holds, which is what the wall covers at rest: a bar's
// picture carries what its content paints outside its box (a button standing
// up out of a tab bar), so its rectangle is taken with its descendants'. The
// pages' is their own box — the movement cuts them at it anyway.
const pictureRect = (target) => {
  const rect = target.getBoundingClientRect();
  let { left, top, right, bottom } = rect;
  if (!target.matches(FIXED_BAR_SELECTOR)) {
    return { left, top, right, bottom };
  }
  for (const descendant of target.querySelectorAll("*")) {
    if (descendant.hasAttribute(WALL_ATTRIBUTE)) {
      continue;
    }
    const descendantRect = descendant.getBoundingClientRect();
    if (descendantRect.width === 0 || descendantRect.height === 0) {
      continue;
    }
    if (descendantRect.left < left) {
      left = descendantRect.left;
    }
    if (descendantRect.top < top) {
      top = descendantRect.top;
    }
    if (descendantRect.right > right) {
      right = descendantRect.right;
    }
    if (descendantRect.bottom > bottom) {
      bottom = descendantRect.bottom;
    }
  }
  return { left, top, right, bottom };
};

// The holes for the movement, and the ones for its last frame (see the CSS).
const cutRestWalls = (holes, holesArriving = null) => {
  for (const restWall of restWallElements) {
    restWall.style.setProperty("--wall-holes", holesPolygon(holes));
    if (holesArriving) {
      restWall.style.setProperty(
        "--wall-holes-arriving",
        holesPolygon(holesArriving),
      );
    }
  }
};

// One evenodd polygon: the window, then each hole entered from and left by
// the window's origin, so the bridges between them have no area. The holes
// must not overlap — evenodd fills where two of them do — and they do
// overlap as measured: the pages run under the bars by design, so a bar's
// rectangle lies inside the area's. Each is cut down to what the ones before
// it left.
const holesPolygon = (holes) => {
  let polygon = "0 0, 100% 0, 100% 100%, 0 100%, 0 0";
  for (const { left, top, right, bottom } of disjointRects(holes)) {
    polygon += `, ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px, 0 0`;
  }
  return `polygon(evenodd, ${polygon})`;
};

const disjointRects = (rects) => {
  const result = [];
  for (const rect of rects) {
    let pieces = [rect];
    for (const placed of result) {
      const remaining = [];
      for (const piece of pieces) {
        remaining.push(...subtractRect(piece, placed));
      }
      pieces = remaining;
    }
    result.push(...pieces);
  }
  return result;
};

// What is left of `rect` outside `hole`: up to four rectangles around it.
const subtractRect = (rect, hole) => {
  if (
    hole.left >= rect.right ||
    hole.right <= rect.left ||
    hole.top >= rect.bottom ||
    hole.bottom <= rect.top
  ) {
    return [rect];
  }
  const pieces = [];
  const innerTop = hole.top > rect.top ? hole.top : rect.top;
  const innerBottom = hole.bottom < rect.bottom ? hole.bottom : rect.bottom;
  if (hole.top > rect.top) {
    pieces.push({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: hole.top,
    });
  }
  if (hole.bottom < rect.bottom) {
    pieces.push({
      left: rect.left,
      top: hole.bottom,
      right: rect.right,
      bottom: rect.bottom,
    });
  }
  if (hole.left > rect.left) {
    pieces.push({
      left: rect.left,
      top: innerTop,
      right: hole.left,
      bottom: innerBottom,
    });
  }
  if (hole.right < rect.right) {
    pieces.push({
      left: hole.right,
      top: innerTop,
      right: rect.right,
      bottom: innerBottom,
    });
  }
  return pieces;
};

const removeRestWalls = () => {
  for (const restWall of restWallElements) {
    restWall.remove();
  }
  restWallElements = [];
  restWallOpacity = "0";
  leavingRects = new Map();
};
