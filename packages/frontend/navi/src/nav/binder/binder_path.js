/**
 * The binder outline: one closed path wrapping the tab row AND the page, with
 * the current tab opening into the page through concave junction curves.
 *
 * Why a path instead of CSS borders — CSS cannot do either of these:
 *   1. Omit one side of a border while keeping the surrounding corners intact
 *      (the current tab has no border on the page side, so it merges with it).
 *   2. Curve a corner inward (concave), which is what a tab-to-page junction
 *      is. `border-radius` only bulges outward.
 *
 * Everything here is in "path space": the main axis (along the tab row) is x
 * and the cross axis goes from the tabs toward the page, whatever the real
 * orientation. Tabs left/right reuse the top/bottom builders and transpose the
 * result at the end.
 *
 * The path is a centerline: it runs half a border-width inside the box edges,
 * so a stroke of `borderWidth` covers exactly the border area the CSS borders
 * of the inactive tabs occupy, and the two line up.
 */

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

/**
 * @param {object} params
 * @param {number} params.tabX - Where the current tab starts along the tab row.
 * @param {number} params.tabWidth - Its size along the tab row.
 * @param {number} params.tabRowHeight - From the outer edge of the tab row to
 *   the junction line where tabs meet the page.
 * @param {number} params.panelWidth - The whole binder, along the tab row.
 * @param {number} params.panelHeight - From the junction line to the far edge
 *   of the page.
 * @param {number} params.gapBeforeTabs - Free room before the first tab, and
 * @param {number} params.gapAfterTabs - after the last one: a page corner on
 *   the tab-row side is only rounded when its gap has room for the radius.
 * @param {"top"|"bottom"|"left"|"right"} params.tabsPosition
 * @returns {string} An SVG path `d` attribute.
 */
export const buildBinderPath = ({
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
