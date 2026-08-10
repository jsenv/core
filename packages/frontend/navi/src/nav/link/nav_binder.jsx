/**
 * The <Nav variant="binder"> border: a single SVG filled path wrapping the nav
 * AND its panel (the nav's sibling element, per panelPosition), so the current
 * tab visually merges into the panel through concave "s-curve" junctions.
 *
 * Why SVG instead of CSS borders:
 * 1. The current tab must have no border on the panel side so it merges with
 *    the panel — CSS cannot omit one side of a border while keeping the
 *    surrounding corners intact.
 * 2. The corners where the tab meets the panel need an inward (concave) curve,
 *    the opposite of what CSS border-radius produces.
 *
 * The path is built in "path space" where the main axis (along the tab row)
 * is x. Tabs left/right reuse the top/bottom builders and transpose the
 * result (x/y swap — a mirror transform, hence the arc sweep flip).
 *
 * The component measures the DOM (nav, current link, panel sibling) rather
 * than receiving sizes as props: the drawn shape must follow whatever layout
 * produced, including content-driven sizes it cannot know ahead of time.
 * Configuration is read from CSS vars on the nav (--nav-border-width,
 * --nav-border-radius, --nav-border-color, --nav-background) so the variant
 * is themed the same way as the rest of the nav.
 */

import { useLayoutEffect, useRef, useState } from "preact/hooks";

export const NavBinderSvg = ({ panelPosition, vertical }) => {
  const svgRef = useRef(null);
  const [drawing, setDrawing] = useState(null);
  const lastDrawingJsonRef = useRef(null);

  useLayoutEffect(() => {
    const svgEl = svgRef.current;
    const navEl = svgEl.closest(".navi_nav");
    const panelEl =
      panelPosition === "before"
        ? navEl.previousElementSibling
        : navEl.nextElementSibling;

    const measure = () => {
      const nextDrawing = measureDrawing({
        navEl,
        panelEl,
        panelPosition,
        vertical,
      });
      // Our own svg updates re-trigger the observers; only set state on
      // actual geometry change so the loop settles.
      const nextDrawingJson = JSON.stringify(nextDrawing);
      if (nextDrawingJson === lastDrawingJsonRef.current) {
        return;
      }
      lastDrawingJsonRef.current = nextDrawingJson;
      setDrawing(nextDrawing);
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(navEl);
    if (panelEl) {
      resizeObserver.observe(panelEl);
    }
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(navEl, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    measure();
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [panelPosition, vertical]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: drawing ? `${drawing.left}px` : "0",
        top: drawing ? `${drawing.top}px` : "0",
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 1,
      }}
      width={drawing ? drawing.width : 0}
      height={drawing ? drawing.height : 0}
    >
      {drawing && (
        <path
          d={drawing.path}
          fill={drawing.background}
          stroke={drawing.borderColor}
          stroke-width={drawing.borderWidth}
        />
      )}
    </svg>
  );
};

const measureDrawing = ({ navEl, panelEl, panelPosition, vertical }) => {
  if (!panelEl) {
    return null;
  }
  const linkEls = navEl.querySelectorAll(".navi_link");
  if (linkEls.length === 0) {
    return null;
  }
  const currentLinkEl = navEl.querySelector(".navi_link[data-href-current]");
  if (!currentLinkEl) {
    return null;
  }

  const navComputedStyle = getComputedStyle(navEl);
  const readVar = (name) => navComputedStyle.getPropertyValue(name).trim();
  const borderWidth = parseFloat(readVar("--nav-border-width")) || 0;
  const cornerRadius = parseFloat(readVar("--nav-border-radius")) || 0;
  const borderColor = readVar("--nav-border-color") || "grey";
  const background = readVar("--nav-background") || "white";

  const navRect = navEl.getBoundingClientRect();
  const panelRect = panelEl.getBoundingClientRect();
  const unionLeft =
    navRect.left < panelRect.left ? navRect.left : panelRect.left;
  const unionTop = navRect.top < panelRect.top ? navRect.top : panelRect.top;
  const unionRight =
    navRect.right > panelRect.right ? navRect.right : panelRect.right;
  const unionBottom =
    navRect.bottom > panelRect.bottom ? navRect.bottom : panelRect.bottom;
  const unionWidth = unionRight - unionLeft;
  const unionHeight = unionBottom - unionTop;

  // Path space: the main axis runs along the tab row (x for top/bottom tabs,
  // y for left/right tabs), the cross axis goes from tabs toward the panel.
  const toPathSpace = (rect) => {
    if (vertical) {
      return {
        start: rect.top - unionTop,
        size: rect.height,
        crossStart: rect.left - unionLeft,
        crossEnd: rect.right - unionLeft,
      };
    }
    return {
      start: rect.left - unionLeft,
      size: rect.width,
      crossStart: rect.top - unionTop,
      crossEnd: rect.bottom - unionTop,
    };
  };

  const tabsFirst = panelPosition !== "before";
  const tabsPosition = vertical
    ? tabsFirst
      ? "left"
      : "right"
    : tabsFirst
      ? "top"
      : "bottom";

  const mainSize = vertical ? unionHeight : unionWidth;
  const crossSize = vertical ? unionWidth : unionHeight;
  const current = toPathSpace(currentLinkEl.getBoundingClientRect());
  const first = toPathSpace(linkEls[0].getBoundingClientRect());
  const last = toPathSpace(linkEls[linkEls.length - 1].getBoundingClientRect());

  // The junction border band is drawn INSIDE the tab row (tabs overlap it by
  // borderWidth — their margin on the panel side leaves the room for it).
  let tabRowHeight;
  let panelHeight;
  if (tabsFirst) {
    tabRowHeight = current.crossEnd;
    panelHeight = crossSize - current.crossEnd;
  } else {
    panelHeight = current.crossStart + borderWidth;
    tabRowHeight = crossSize - current.crossStart - borderWidth;
  }

  const path = buildBinderCenterlinePath({
    tabX: current.start,
    tabWidth: current.size,
    tabRowHeight,
    panelWidth: mainSize,
    panelHeight,
    borderWidth,
    cornerRadius,
    gapBeforeTabs: first.start,
    gapAfterTabs: mainSize - (last.start + last.size),
    tabsPosition,
  });

  return {
    left: unionLeft - navRect.left,
    top: unionTop - navRect.top,
    width: unionWidth,
    height: unionHeight,
    path,
    borderWidth,
    borderColor,
    background,
  };
};

// Low-level arc helpers: produce SVG arc commands with an explicit sweep flag.
// sweep=1 → clockwise arc; sweep=0 → counter-clockwise arc.
const arcSweep1 = (r, dx, dy) => {
  if (r <= 0) {
    return `l ${dx},${dy}`;
  }
  return `a ${r},${r} 0 0 1 ${dx},${dy}`;
};
const arcSweep0 = (r, dx, dy) => {
  if (r <= 0) {
    return `l ${dx},${dy}`;
  }
  return `a ${r},${r} 0 0 0 ${dx},${dy}`;
};
// Semantic aliases used when drawing the CW outer path.
// In a CW path: convex (outward) corners use sweep=1, concave (inward) use sweep=0.
const arcConvex = arcSweep1;
const arcConcave = arcSweep0;

// Swaps x and y in a command list produced by the path builders (only
// M/h/v/l/a/Z commands, in the exact format they emit). Swapping axes is a
// mirror transform, so arc sweep flags must flip.
const transposePath = (commands) =>
  commands.map((command) => {
    const parts = command.split(" ");
    const type = parts[0];
    if (type === "M" || type === "l") {
      const [x, y] = parts[1].split(",");
      return `${type} ${y},${x}`;
    }
    if (type === "h") {
      return `v ${parts[1]}`;
    }
    if (type === "v") {
      return `h ${parts[1]}`;
    }
    if (type === "a") {
      const sweep = parts[4] === "1" ? "0" : "1";
      const [dx, dy] = parts[5].split(",");
      return `a ${parts[1]} ${parts[2]} ${parts[3]} ${sweep} ${dy},${dx}`;
    }
    return command;
  });

// "left"/"right" reuse the "top"/"bottom" builders in a coordinate space
// where the main axis (along the tab row) is x — the result is then
// transposed so the tab row runs vertically.
const buildBinderCenterlinePath = ({
  tabX,
  tabWidth,
  tabRowHeight,
  panelWidth,
  panelHeight,
  borderWidth,
  cornerRadius,
  gapBeforeTabs,
  gapAfterTabs,
  tabsPosition,
}) => {
  const h = borderWidth / 2;
  const r = cornerRadius - h < 0 ? 0 : cornerRadius - h;
  // Panel corners on the tab-row side only get rounded when the gap before /
  // after the tabs leaves room for the full radius.
  const gapAfter = gapAfterTabs < 0 ? 0 : gapAfterTabs;
  const rTR = gapAfter >= r ? r : 0;
  const gapBefore = gapBeforeTabs < 0 ? 0 : gapBeforeTabs;
  const rTL = gapBefore >= r ? r : 0;

  const params = {
    tabX,
    tabWidth,
    tabRowHeight,
    panelWidth,
    panelHeight,
    h,
    r,
    rTR,
    rTL,
  };
  const d =
    tabsPosition === "top" || tabsPosition === "left"
      ? buildBinderCenterlinePathAbove(params)
      : buildBinderCenterlinePathBelow(params);
  const commands =
    tabsPosition === "left" || tabsPosition === "right" ? transposePath(d) : d;
  return commands.join(" ");
};

// Builds the centerline path when tabs are ABOVE the panel.
// CW path: M(tabLeft+r, top) → tab top → tab TR → [right junction] → panel TR
//   → panel right ↓ → panel BR → panel bottom ← → panel BL → panel left ↑ → [left junction] → tab TL → Z
const buildBinderCenterlinePathAbove = ({
  tabX,
  tabWidth,
  tabRowHeight,
  panelWidth,
  panelHeight,
  h,
  r,
  rTR,
  rTL,
}) => {
  const hasRightJunction = tabX + tabWidth < panelWidth;
  const hasLeftJunction = tabX > 0;

  const left = h;
  const top = h;
  const right = panelWidth - h;
  const bottom = tabRowHeight + panelHeight - h;
  const tabLeft = tabX + h;
  const tabRight = tabX + tabWidth - h;
  const junctionY = tabRowHeight - h;

  const rVSpace = junctionY - top - r;
  const rTotalHSpace = right - tabRight;
  const rFits = hasRightJunction && rVSpace >= r && rTotalHSpace >= r + rTR;

  const lVSpace = junctionY - top - r;
  const lTotalHSpace = tabLeft - left - rTL; // capped by gap left of first tab
  // lFits: room for panel TL arc (rTL) + concave junction arc (r)
  const lFits = hasLeftJunction && lVSpace >= r && lTotalHSpace >= r;
  // lTight: only room for panel TL arc, skip concave — favor panel rounding
  const lTight = hasLeftJunction && lVSpace >= r && lTotalHSpace >= 0;

  const d = [];
  d.push(`M ${tabLeft + r},${top}`);
  d.push(`h ${tabRight - r - (tabLeft + r)}`);

  // ── Right side ────────────────────────────────────────────────────────────
  if (!hasRightJunction) {
    d.push(arcConvex(r, r, r));
    d.push(`v ${bottom - top - 2 * r}`);
  } else if (rFits) {
    d.push(arcConvex(r, r, r)); // tab TR: right→down
    d.push(`v ${rVSpace - r}`); // tab right ↓ to concave arc start
    d.push(arcConcave(r, r, r)); // junction concave: down→right
    d.push(`h ${rTotalHSpace - r - rTR}`); // panel top →
    d.push(arcConvex(rTR, rTR, rTR)); // panel TR: right→down
    d.push(`v ${bottom - junctionY - rTR - r}`); // panel right ↓
  } else {
    d.push(arcConvex(r, r, r)); // tab TR: right→down
    d.push(`v ${rVSpace}`); // straight down to junctionY
    d.push(`h ${rTotalHSpace - rTR}`); // panel top →
    d.push(arcConvex(rTR, rTR, rTR)); // panel TR: right→down (clamped)
    d.push(`v ${bottom - junctionY - rTR - r}`); // panel right ↓
  }

  // ── Panel BR → bottom → BL ────────────────────────────────────────────────
  d.push(arcConvex(r, -r, r));
  d.push(`h -${right - left - 2 * r}`);
  d.push(arcConvex(r, -r, -r));

  // ── Panel left ↑ + left junction back to M ───────────────────────────────
  if (!hasLeftJunction) {
    d.push(`v -${bottom - top - 2 * r}`);
    d.push(arcConvex(r, r, -r)); // panel TL = tab TL: up→right
  } else if (lFits) {
    d.push(`v -${bottom - junctionY - r - rTL}`); // panel left ↑ to (left, junctionY+rTL)
    d.push(arcConvex(rTL, rTL, -rTL)); // panel TL: up→right
    d.push(`h ${lTotalHSpace - r}`); // panel top → to (tabLeft-r, junctionY)
    d.push(arcConcave(r, r, -r)); // junction concave: right→up
    d.push(`v -${lVSpace - r}`); // tab left ↑
    d.push(arcConvex(r, r, -r)); // tab TL: up→right
  } else if (lTight) {
    // Panel TL rounded, no concave — square tab corner
    d.push(`v -${bottom - junctionY - r - rTL}`); // panel left ↑ to (left, junctionY+rTL)
    d.push(arcConvex(rTL, rTL, -rTL)); // panel TL: up→right
    d.push(`h ${lTotalHSpace}`); // panel top → to (tabLeft, junctionY)
    d.push(`v -${lVSpace}`); // tab left ↑
    d.push(arcConvex(r, r, -r)); // tab TL: up→right
  } else {
    d.push(`v -${bottom - junctionY - r}`); // panel left ↑ to junctionY
    d.push(`h ${lTotalHSpace}`); // panel top →
    d.push(`v -${lVSpace}`); // tab left ↑
    d.push(arcConvex(r, r, -r)); // tab TL: up→right
  }

  d.push("Z");
  return d;
};

// Builds the centerline path when tabs are BELOW the panel.
// CW path: M(left+r, top) → panel top → panel TR → panel right ↓ → [right junction] →
//   tab right ↓ → tab BR → tab bottom ← → [left junction] → tab BL → tab left ↑ → panel left ↑ → panel TL → Z
//
// Right junction: panel right ↓ to junctionY (square corner), left along panel bottom gap,
//   concave notch arc (left→down), tab right ↓.
// Left junction: tab left ↑, concave notch arc (up→left), left along panel bottom gap to panel left
//   (square corner), panel left ↑.
const buildBinderCenterlinePathBelow = ({
  tabX,
  tabWidth,
  tabRowHeight,
  panelWidth,
  panelHeight,
  h,
  r,
  rTR,
  rTL,
}) => {
  const hasRightJunction = tabX + tabWidth < panelWidth;
  const hasLeftJunction = tabX > 0;

  const left = h;
  const top = h;
  const right = panelWidth - h;
  const bottom = panelHeight + tabRowHeight - h;
  const tabLeft = tabX + h;
  const tabRight = tabX + tabWidth - h;
  const junctionY = panelHeight - h;

  // Vertical room on panel right/left sides (between panel corner at top and junction at junctionY)
  const rPanelVSpace = junctionY - top - r;

  // Right junction: panel BR corner uses rTR (gap right of last tab)
  const rTotalHSpace = right - tabRight - rTR;
  // rFits: room for panel BR arc (rTR) + concave junction arc (r)
  const rFits = hasRightJunction && rPanelVSpace >= r && rTotalHSpace >= r;
  // rTight: only room for panel BR arc (rTR), skip concave — favor panel rounding
  const rTight = hasRightJunction && rPanelVSpace >= r && rTotalHSpace >= 0;

  // Left junction: panel BL corner uses rTL (gap left of first tab)
  const lTotalHSpace = tabLeft - left - rTL;
  // lFits: room for concave junction arc (r) + panel BL arc (rTL)
  const lFits = hasLeftJunction && rPanelVSpace >= r && lTotalHSpace >= r;
  // lTight: only room for panel BL arc (rTL), skip concave — favor panel rounding
  const lTight = hasLeftJunction && rPanelVSpace >= r && lTotalHSpace >= 0;

  const d = [];

  // M: start after panel TL arc, going right along panel top
  d.push(`M ${left + r},${top}`);
  d.push(`h ${right - left - 2 * r}`); // panel top →

  // ── Right side: panel right ↓ then (junction or direct) tab right ↓ ──────
  if (!hasRightJunction) {
    d.push(arcConvex(r, r, r)); // panel TR: right→down
    d.push(`v ${bottom - top - 2 * r}`); // full right side ↓
    d.push(arcConvex(r, -r, r)); // tab BR = panel BR: down→left
  } else if (rFits) {
    d.push(arcConvex(r, r, r)); // panel TR: right→down
    d.push(`v ${rPanelVSpace - rTR}`); // panel right ↓ to (right, junctionY-rTR)
    d.push(arcConvex(rTR, -rTR, rTR)); // panel BR: down→left
    d.push(`h -${rTotalHSpace - r}`); // panel bottom ← to (tabRight+r, junctionY)
    d.push(arcConcave(r, -r, r)); // junction concave: left→down
    d.push(`v ${bottom - junctionY - 2 * r}`); // tab right ↓ to (tabRight, bottom-r)
    d.push(arcConvex(r, -r, r)); // tab BR: down→left
  } else if (rTight) {
    // Panel BR rounded, no concave — square tab corner
    d.push(arcConvex(r, r, r)); // panel TR: right→down
    d.push(`v ${rPanelVSpace - rTR}`); // panel right ↓ to (right, junctionY-rTR)
    d.push(arcConvex(rTR, -rTR, rTR)); // panel BR: down→left
    d.push(`h -${rTotalHSpace}`); // panel bottom ← to (tabRight, junctionY)
    d.push(`v ${bottom - junctionY - r}`); // tab right ↓ to (tabRight, bottom-r)
    d.push(arcConvex(r, -r, r)); // tab BR: down→left
  } else {
    // Very tight: all square corners
    d.push(arcConvex(r, r, r)); // panel TR: right→down
    d.push(`v ${rPanelVSpace}`); // panel right ↓ to junctionY
    d.push(`h -${right - tabRight}`); // panel bottom ← to tabRight
    d.push(`v ${bottom - junctionY - r}`); // tab right ↓ to (tabRight, bottom-r)
    d.push(arcConvex(r, -r, r)); // tab BR: down→left
  }

  // ── Tab bottom ← ──────────────────────────────────────────────────────────
  d.push(`h -${tabRight - r - (tabLeft + r)}`); // tab bottom ←

  // ── Left side: tab BL → tab left ↑ → (junction or direct) → panel left ↑ → panel TL ──
  if (!hasLeftJunction) {
    d.push(arcConvex(r, -r, -r)); // tab BL = panel BL: left→up
    d.push(`v -${bottom - top - 2 * r}`); // full left side ↑
    d.push(arcConvex(r, r, -r)); // panel TL: up→right → M
  } else if (lFits) {
    d.push(arcConvex(r, -r, -r)); // tab BL: left→up
    d.push(`v -${bottom - junctionY - 2 * r}`); // tab left ↑ to (tabLeft, junctionY+r)
    d.push(arcConcave(r, -r, -r)); // junction concave: up→left
    d.push(`h -${lTotalHSpace - r}`); // panel bottom ← to (left+rTL, junctionY)
    d.push(arcConvex(rTL, -rTL, -rTL)); // panel BL: left→up
    d.push(`v -${rPanelVSpace - rTL}`); // panel left ↑ to (left, top+r)
    d.push(arcConvex(r, r, -r)); // panel TL: up→right → M
  } else if (lTight) {
    // Panel BL rounded, no concave — square tab corner
    d.push(arcConvex(r, -r, -r)); // tab BL: left→up
    d.push(`v -${bottom - junctionY - r}`); // tab left ↑ to (tabLeft, junctionY)
    d.push(`h -${lTotalHSpace}`); // panel bottom ← to (left+rTL, junctionY)
    d.push(arcConvex(rTL, -rTL, -rTL)); // panel BL: left→up
    d.push(`v -${rPanelVSpace - rTL}`); // panel left ↑ to (left, top+r)
    d.push(arcConvex(r, r, -r)); // panel TL: up→right → M
  } else {
    // Very tight: all square corners
    d.push(arcConvex(r, -r, -r)); // tab BL: left→up
    d.push(`v -${bottom - junctionY - r}`); // tab left ↑ to junctionY
    d.push(`h -${tabLeft - left}`); // panel bottom ← to left
    d.push(`v -${rPanelVSpace}`); // panel left ↑ to (left, top+r)
    d.push(arcConvex(r, r, -r)); // panel TL: up→right → M
  }

  d.push("Z");
  return d;
};
