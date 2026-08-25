/**
 * Where one stands in a walk of steps, drawn as dots on a path.
 *
 * Two distinct facts, drawn separately — they usually agree, and everything
 * this component says comes from the moments they do not:
 *
 * - DONE and the PATH (the blue fill). The mental model, to keep in mind
 *   when touching any of this: the circles are THINGS TO DO, and the path is
 *   the progression along the linear walk from the first to the last — a
 *   thing done is what lets the path advance. Answering a step fills its
 *   dot AND the line onward, up to the NEXT dot: the invitation to go
 *   there. If that next step is already done the path crosses it from
 *   behind and carries on, and so forth — the fill covers the answered
 *   prefix plus one segment of appetite. It stops at the edge of the first
 *   dot not answered, which stays empty: the fill's one meaning is
 *   "answered", and the first dot is NOT filled on arrival — it becomes so
 *   by being answered. Past the fill the line is dashed, the road not
 *   walked yet; steps answered out of order are filled dots standing alone,
 *   dashed segments around them: the holes, readable at a glance.
 * - the POSITION (`current`): the step being looked at, marked by a halo
 *   around its dot and its label emphasized. It travels freely, so it can
 *   be AHEAD of the path or BEHIND it.
 *
 * Both move smoothly on change (a CSS transition each), so pressing a step
 * or answering one is seen travelling rather than jumping.
 *
 * The steps are the CHILDREN — <StepList.Item value="club">Club</StepList.Item>.
 * An Item renders nothing: it REGISTERS with the list as it renders (order
 * of rendering is the order of the steps), and the list draws everything —
 * which is what lets an Item come from anywhere: a .map(), a fragment, a
 * component of your own wrapping it. One caveat comes with reading the
 * children as they render: hand the list fresh Item vnodes on each render
 * (the usual JSX), not a memoized array a bailout would keep from rendering.
 *
 * The dots are drawn in SVG, twice: a muted layer, and a filled layer
 * clipped at the path's edge — the clip is what makes the path's progress a
 * single sweep that fills the line and the dots it crosses in one movement.
 * The line is drawn as segments between the dots (never behind them), so the
 * dots need no background of their own and the component sits on any
 * surface. Colors are CSS custom properties (see the css below), overridden
 * from outside for a dark band or a different accent.
 *
 * `slideContainer` connects the list to a <SlideContainer> by id, both ways:
 * pressing a step travels there (--navi-go-to-slide), and the position is
 * READ off the container rather than said by a prop — including mid-travel:
 * the container paints --slide-travel-progress on this element (it is a
 * follower, same mechanism as <Nav slideContainer>), so the halo rides the
 * drag under the finger, in CSS alone. The path is not concerned: it moves
 * on answers, never on movement.
 */

import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { Button } from "../control/input/button.jsx";
import { useFocusGroup } from "../utils/focus/use_focus_group.js";

const css = /* css */ `
  .navi_step_list {
    /* The knobs: one accent for everything filled — the dots and the line
       share it, because the fill has ONE meaning (answered) and a meaning
       does not change color. Muted is what is not answered, on-accent
       writes on filled dots. Said from OUTSIDE (any ancestor — a dark band,
       a themed app) on the plain names; resolved here through an
       indirection (--x-…, the way Button does), because a default written
       on the plain name on this very element would beat anything an
       ancestor says. */
    --x-step-list-accent: var(--step-list-accent, #4f8ef7);
    --x-step-list-on-accent: var(--step-list-on-accent, white);
    --x-step-list-muted: var(--step-list-muted, light-dark(#8a93a8, #8b99b8));
    --x-step-list-line: var(
      --step-list-line,
      light-dark(#c9d0dd, rgba(255, 255, 255, 0.35))
    );
    --x-step-list-current-color: var(
      --step-list-current-color,
      light-dark(#1c2433, white)
    );
    /* How long a movement takes — the path sweeping, the halo sliding. One
       number for all of them: they tell one story. */
    --x-step-list-duration: var(--step-list-duration, 300ms);

    position: relative;
    display: block;
    height: 64px;
  }
  .navi_step_list_rail {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  }
  /* The road not walked yet. */
  .navi_step_list_rail line {
    stroke: var(--x-step-list-line);
    stroke-width: 2;
    stroke-dasharray: 4 5;
  }
  .navi_step_list_rail circle {
    fill: none;
    stroke: var(--x-step-list-muted);
    stroke-width: 1.5;
  }
  .navi_step_list_rail text {
    font-weight: 600;
    font-size: 12px;
    fill: var(--x-step-list-muted);
  }
  /* The current dot says so in the drawing itself, not only by its halo: on
     a dark band a muted number under a faint ring reads as nothing. Said in
     the base layer only (see renderRail) — a current dot the path has
     covered keeps the filled colors. */
  .navi_step_list_rail g[data-current] circle {
    stroke: var(--x-step-list-current-color);
  }
  .navi_step_list_rail g[data-current] text {
    fill: var(--x-step-list-current-color);
  }
  /* A step answered has its dot filled, wherever the path stands: answered
     out of order it stands alone, a filled dot between dashed segments.
     After the current rule on purpose: answered wins the drawing, the halo
     says current. */
  .navi_step_list_rail g[data-done] circle {
    fill: var(--x-step-list-accent);
    stroke: var(--x-step-list-accent);
  }
  .navi_step_list_rail g[data-done] text {
    fill: var(--x-step-list-on-accent);
  }
  /* The path: same drawing, filled, revealed up to the fill's edge — the
     answered prefix plus its segment of appetite (see the top comment). The
     clip is set inline (a width in px); transitioning it is what makes an
     answered step SWEEP its dot and the line onward rather than pop. */
  .navi_step_list_rail_filled {
    transition: clip-path var(--x-step-list-duration) ease;
  }
  .navi_step_list_rail_filled line {
    stroke: var(--x-step-list-accent);
    stroke-dasharray: none;
  }
  .navi_step_list_rail_filled circle {
    fill: var(--x-step-list-accent);
    stroke: var(--x-step-list-accent);
  }
  .navi_step_list_rail_filled text {
    fill: var(--x-step-list-on-accent);
  }
  /* The position: a halo around the dot being looked at. It slides from dot
     to dot (transform, transitioned) — the g moves, the circle inside is
     drawn at x=0. */
  .navi_step_list_marker {
    transition: transform var(--x-step-list-duration) ease;
  }
  .navi_step_list_marker circle {
    fill: none;
    stroke: color-mix(in srgb, var(--x-step-list-accent) 65%, transparent);
    stroke-width: 1.5;
  }

  /* Connected to slides: the movement is not this component's anymore. The
     container paints --slide-travel-progress here (this element follows it,
     see data-slide-container-follows) — an asked-for travel animates it, a
     finger drags it — and everything below is a calc() of that number, so
     the halo and the path move per frame in CSS alone.
     Position, in dots-x px: where the picture is right now. */
  .navi_step_list[data-slide-container-follows] {
    --step-list-position: calc(
      var(--step-list-pos-x, 0) + var(--slide-travel-progress) *
        var(--step-list-pos-dx, 0)
    );
  }
  .navi_step_list[data-slide-container-follows] .navi_step_list_marker {
    transform: translateX(calc(var(--step-list-position) * 1px));
    transition: none;
  }

  /* One press target per step, covering the dot AND the label under it. The
     feedback is NOT the whole surface: a rectangle would say the whole band
     is a button, when the affordance is the dot — so hover and focus land on
     a circle drawn over the dot, plus the label brightening.
     --step-dot-x anchors both on the dot, wherever the dot sits in the slot:
     the first and last slots are asymmetric (cut at the container's edge,
     see the geometry in the component). */
  .navi_step_list_slot {
    position: absolute;
    top: 0;
    box-sizing: border-box;
    height: 100%;
  }
  /* Doubled selector: the button's own state formulas (a readonly color
     mixed at the variant level) are declared in navi's stylesheet, injected
     after this one — specificity is what makes these values the ones read. */
  .navi_step_list .navi_step_list_step {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    font-size: 12px;
    outline: none;
    --button-color: var(--x-step-list-muted);
    --button-color-readonly: var(--x-step-list-muted);
    /* The button's own focus ring, silenced: it would outline the whole
       press surface, and the ring this list draws is the one around the dot
       (see below) — two rings read as a mistake. Width rather than style,
       because the dot sets its own style in full. */
    --button-outline-width: 0px;
  }
  /* Centered on the dot: same vertical middle as the rail (top 0, height 34,
     cy 17). A real element rather than a ::before, because it is also what a
     callout anchors to (data-callout-anchor needs a selector) — a message
     about a step points at its CIRCLE, not at the press surface. */
  .navi_step_list_dot {
    position: absolute;
    top: 17px;
    left: var(--step-dot-x);
    width: 30px;
    height: 30px;
    border-radius: 50%;
    translate: -50% -50%;
    pointer-events: none;
  }
  .navi_step_list_step:hover .navi_step_list_dot,
  .navi_step_list_step[data-hover] .navi_step_list_dot {
    background: color-mix(in srgb, var(--x-step-list-accent) 15%, transparent);
  }
  .navi_step_list .navi_step_list_step:hover,
  .navi_step_list .navi_step_list_step[data-hover] {
    --button-color: var(--x-step-list-current-color);
  }
  .navi_step_list_step:focus-visible .navi_step_list_dot,
  .navi_step_list_step[data-focus-visible] .navi_step_list_dot {
    outline-width: var(--navi-focus-outline-width);
    outline-style: solid;
    outline-color: var(--navi-focus-outline-color);
    outline-offset: 1px;
  }
  .navi_step_list_label {
    position: absolute;
    bottom: 6px;
    left: var(--step-dot-x);
    white-space: nowrap;
    translate: -50% 0;
  }
  .navi_step_list .navi_step_list_step[data-current] {
    font-weight: 600;
    --button-color: var(--x-step-list-current-color);
    --button-color-readonly: var(--x-step-list-current-color);
  }
`;

const RAIL_H = 34;
const DOT_R = 11;
const RING_R = 14.5;
// Room for the first and last dot (and their halo) not to touch the edges.
const EDGE_INSET = 30;
// Between a dot's edge and the line running to the next one: enough for the
// halo of a current dot not to sit on the line.
const LINE_GAP = 5;

// What the Items say to the list holding them (see Step): where to write
// themselves down. Null outside any list — a Step alone renders nothing and
// registers nowhere.
const StepListContext = createContext(null);

/**
 * @type {import("preact").FunctionComponent<{
 *   current?: string,
 *   slideContainer?: string,
 *   travelByClick?: boolean,
 *   travelByKeyboard?: boolean,
 *   duration?: string,
 *   [key: string]: any,
 * }>}
 * @param {string} [current] - the step being looked at: its dot gets the
 *   halo, its label the emphasis. Omit for "nowhere" — a confirmation
 *   screen after the walk, say. With `slideContainer` the position is read
 *   off the container instead, and this prop is ignored.
 * @param {string} [slideContainer] - id of a <SlideContainer> these steps
 *   are the slides of. Pressing a step travels there
 *   (--navi-go-to-slide), the halo follows the container — drags included —
 *   and this element becomes a follower of the container
 *   (data-slide-container-follows), which is also what keeps the arrow keys
 *   working from here.
 * @param {boolean} [travelByClick=true] - whether pressing a step goes
 *   there. Off, the steps are read-only — shown, not offered. To DO
 *   something on a press, say `onClick` on the Item itself: like every other
 *   prop an Item carries, it lands on that step's button.
 * @param {boolean} [travelByKeyboard=true] - whether the arrow keys walk
 *   from one step to the other (the focus moves, Enter presses). Only when
 *   the list stands alone: connected to slides the arrows belong to the
 *   CONTAINER — this element is a follower, so a press here already walks
 *   the slides, and the container's own `travelByKeyboard` is the one that
 *   says so. One owner per mode, or one arrow would do both.
 * @param {string} [duration] - how long a movement takes (the path
 *   sweeping, the halo sliding), any CSS duration. 300ms unless said —
 *   here, or from outside via --step-list-duration.
 */
export const StepList = ({
  current,
  slideContainer,
  travelByClick = true,
  travelByKeyboard = true,
  duration,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const rootRef = useRef();
  // The dots spread over whatever width the component is given, so the
  // geometry is measured rather than declared — and measured again when the
  // room changes.
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const rootElement = rootRef.current;
    const measure = () => {
      setWidth(rootElement.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rootElement);
    return () => {
      observer.disconnect();
    };
  }, []);

  // The arrows walk the steps — standing alone only: connected, this element
  // follows the container, whose own keydown listener already walks the
  // slides from here (and whose travelByKeyboard says whether to). A focus
  // group on top of that would make one arrow do both.
  useFocusGroup(rootRef, {
    enabled: Boolean(travelByKeyboard) && !slideContainer,
    direction: "x",
  });

  // The roll call: every render of this list opens a fresh page, the Items
  // rendering below write themselves on it (in rendering order, which is the
  // order of the steps), and the layout effect reads the page back. What was
  // read is STATE — the first render knows no steps, the effect's render
  // draws them — and a change in what the Items say (a done toggled) flows
  // the same way: fresh page, fresh read, redraw.
  const registryRef = useRef(null);
  if (!registryRef.current) {
    registryRef.current = { renderedSteps: [] };
  }
  const registry = registryRef.current;
  registry.renderedSteps = [];
  const [steps, setSteps] = useState([]);
  useLayoutEffect(() => {
    const collected = registry.renderedSteps;
    // An empty page while steps are known: the children were most likely
    // bailed out of rendering (memoized vnodes), not removed — keeping the
    // known steps beats erasing the drawing (see the caveat in the top
    // comment).
    if (collected.length === 0 && steps.length > 0) {
      return;
    }
    setSteps((previous) =>
      sameSteps(previous, collected) ? previous : [...collected],
    );
  });

  const stepCount = steps.length;
  const dotXs = [];
  if (width > 0 && stepCount > 0) {
    const span = width - EDGE_INSET * 2;
    let index = 0;
    while (index < stepCount) {
      dotXs.push(
        stepCount === 1
          ? width / 2
          : EDGE_INSET + (span * index) / (stepCount - 1),
      );
      index++;
    }
  }
  const indexOf = (value) => steps.findIndex((step) => step.value === value);

  // Where the slides are, read off the container: which slide is current,
  // and — while a travel or a drag is playing — which one the picture leans
  // towards. The current area re-renders this component (the emphasized
  // label, the data-current dot); the in-between positions never do: they
  // are written as numbers on this element and interpolated by the CSS
  // above, at the pace of --slide-travel-progress.
  const [containerCurrent, setContainerCurrent] = useState(undefined);
  useLayoutEffect(() => {
    if (!slideContainer || dotXs.length === 0) {
      return undefined;
    }
    const containerElement = document.getElementById(slideContainer);
    if (!containerElement) {
      console.warn(
        `<StepList slideContainer="${slideContainer}"> but no element with that id found`,
      );
      return undefined;
    }
    const rootElement = rootRef.current;
    const read = () => {
      const currentArea = containerElement.getAttribute("data-slide-current");
      const towardArea = containerElement.getAttribute(
        "data-slide-travel-toward",
      );
      setContainerCurrent(currentArea ?? undefined);
      const currentIdx = currentArea === null ? -1 : indexOf(currentArea);
      if (currentIdx === -1) {
        // A slide no step names (a confirmation screen): the halo is not
        // rendered, and the last position is left standing for the path.
        return;
      }
      const x = dotXs[currentIdx];
      let dx = 0;
      if (towardArea && towardArea !== currentArea) {
        const towardIdx = indexOf(towardArea);
        if (towardIdx !== -1 && towardIdx !== currentIdx) {
          // The container counts +1 when the picture leans on a slide BEFORE
          // the current one, -1 after: the delta is signed the same way, so
          // progress × delta lands exactly on the other dot.
          const sign = towardIdx > currentIdx ? -1 : 1;
          dx = (dotXs[towardIdx] - x) * sign;
        }
      }
      rootElement.style.setProperty("--step-list-pos-x", x);
      rootElement.style.setProperty("--step-list-pos-dx", dx);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(containerElement, {
      attributes: true,
      attributeFilter: ["data-slide-current", "data-slide-travel-toward"],
    });
    return () => {
      observer.disconnect();
    };
    // width: the dots move when the room does, and the written positions are
    // pixels of those dots.
  }, [slideContainer, width, stepCount]);

  const resolvedCurrent = slideContainer ? containerCurrent : current;
  const currentIndex =
    resolvedCurrent === undefined ? -1 : indexOf(resolvedCurrent);
  // The path, deduced from what the Items say: the steps answered without a
  // gap from the start. -1 when the first step is not answered yet — there
  // is no path then, only dots.
  let pathEndIndex = steps.findIndex((step) => !step.done);
  if (pathEndIndex === -1) {
    pathEndIndex = stepCount;
  }
  pathEndIndex -= 1;
  // How far the fill goes: nowhere while nothing is answered; past the last
  // dot (radius plus stroke) when everything is; otherwise THROUGH the
  // answered prefix and onward to the edge of the next dot — the segment of
  // appetite (see the top comment), with the dot it points at left empty.
  let fillX;
  if (pathEndIndex === -1) {
    fillX = 0;
  } else if (pathEndIndex >= stepCount - 1) {
    fillX = dotXs[stepCount - 1] + DOT_R + 3;
  } else {
    fillX = dotXs[pathEndIndex + 1] - DOT_R - LINE_GAP;
  }
  const cy = RAIL_H / 2;
  const slotWidth = dotXs.length > 1 ? dotXs[1] - dotXs[0] : width;

  const renderRail = (filled) => (
    <svg
      className={
        filled
          ? "navi_step_list_rail navi_step_list_rail_filled"
          : "navi_step_list_rail"
      }
      style={
        filled ? { clipPath: `inset(0 ${width - fillX}px 0 0)` } : undefined
      }
      width={width}
      height={RAIL_H}
      viewBox={`0 0 ${width} ${RAIL_H}`}
      aria-hidden="true"
    >
      {dotXs.map((x, index) => (
        <g
          key={steps[index].value}
          // Base layer only: dots the path covers are drawn filled by the
          // layer above anyway (see the css).
          data-current={!filled && index === currentIndex ? "" : undefined}
          data-done={!filled && steps[index].done ? "" : undefined}
        >
          {index > 0 ? (
            <line
              x1={dotXs[index - 1] + DOT_R + LINE_GAP}
              y1={cy}
              x2={x - DOT_R - LINE_GAP}
              y2={cy}
            />
          ) : null}
          <circle cx={x} cy={cy} r={DOT_R} />
          <text x={x} y={cy} dy="0.36em" text-anchor="middle">
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );

  return (
    <Box
      {...rest}
      ref={rootRef}
      baseClassName="navi_step_list"
      data-step-list=""
      // A follower of the container: the travel's progress is painted here
      // for the CSS to draw with, and the arrow keys keep walking the slides
      // from this element.
      data-slide-container-follows={slideContainer}
      style={{
        ...rest.style,
        ...(duration ? { "--step-list-duration": duration } : undefined),
      }}
    >
      <StepListContext.Provider value={registry}>
        {children}
      </StepListContext.Provider>
      {width > 0 && stepCount > 0 ? (
        <>
          {renderRail(false)}
          {renderRail(true)}
          {currentIndex !== -1 && dotXs[currentIndex] !== undefined ? (
            <svg
              className="navi_step_list_rail"
              width={width}
              height={RAIL_H}
              viewBox={`0 0 ${width} ${RAIL_H}`}
              aria-hidden="true"
            >
              <g
                className="navi_step_list_marker"
                // Connected to slides, the position comes from the CSS calc
                // above — an inline transform would override it.
                style={
                  slideContainer
                    ? undefined
                    : { transform: `translateX(${dotXs[currentIndex]}px)` }
                }
              >
                <circle cx="0" cy={cy} r={RING_R} />
              </g>
            </svg>
          ) : null}
          {steps.map((step, index) => {
            // The slots tile the row, cut at the container's edges: the
            // first and the last cover only the inner half of the room an
            // interior slot gets, so pressing just outside the box presses
            // nothing.
            const first = index === 0;
            const last = index === stepCount - 1;
            const slotLeft = first
              ? dotXs[index] - EDGE_INSET
              : dotXs[index] - slotWidth / 2;
            const slotRight = last
              ? dotXs[index] + EDGE_INSET
              : dotXs[index] + slotWidth / 2;
            return (
              <div
                key={step.value}
                className="navi_step_list_slot"
                style={{
                  "left": `${slotLeft}px`,
                  "width": `${slotRight - slotLeft}px`,
                  "--step-dot-x": `${dotXs[index] - slotLeft}px`,
                }}
              >
                <Button
                  {...step.buttonProps}
                  // bare, not discrete: what is drawn IS the dot and its
                  // label — the hover wash a discrete button paints over its
                  // whole surface is exactly what must not appear here (the
                  // feedback is the circle over the dot, see the css).
                  variant="bare"
                  className="navi_step_list_step"
                  aria-current={index === currentIndex ? "step" : undefined}
                  data-current={index === currentIndex ? "" : undefined}
                  readOnly={!travelByClick}
                  // Towards the slides when connected, by name: the command
                  // reaches the container wherever this list sits on the
                  // page. What else a press should do is the Item's own
                  // onClick, which arrived through buttonProps.
                  command={
                    slideContainer && travelByClick
                      ? `--navi-go-to-slide:${step.value}`
                      : undefined
                  }
                  commandFor={slideContainer}
                  // A message about a step (a callout) points at its circle,
                  // above it: the label lives below.
                  data-callout-anchor=".navi_step_list_dot"
                  data-callout-position="top"
                >
                  <span className="navi_step_list_dot" aria-hidden="true" />
                  <span className="navi_step_list_label">{step.label}</span>
                </Button>
              </div>
            );
          })}
        </>
      ) : null}
    </Box>
  );
};

// The same steps saying the same things: nothing to redraw. The labels are
// vnodes, fresh objects on every render — comparing them would always say
// "changed", so they are left out: what they show changes through the state
// it came from, which re-renders this list anyway.
const sameSteps = (previousSteps, nextSteps) => {
  if (previousSteps.length !== nextSteps.length) {
    return false;
  }
  let index = 0;
  while (index < previousSteps.length) {
    const previous = previousSteps[index];
    const next = nextSteps[index];
    if (previous.value !== next.value || previous.done !== next.done) {
      return false;
    }
    if (!sameShallow(previous.buttonProps, next.buttonProps)) {
      return false;
    }
    index++;
  }
  return true;
};

const sameShallow = (previousObject, nextObject) => {
  const previousKeys = Object.keys(previousObject);
  const nextKeys = Object.keys(nextObject);
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }
  for (const key of previousKeys) {
    if (previousObject[key] !== nextObject[key]) {
      return false;
    }
  }
  return true;
};

/**
 * One step of the walk: `value` names it (what `current` says and what a
 * press reports), `done` says it is answered (its dot fills, and the path is
 * deduced from the answered steps), the children are its label.
 *
 * It renders NOTHING: it registers with the list around it as it renders,
 * and the list draws everything — the dot, the label, the button. Whatever
 * else it carries (onClick, pseudoState, aria-*) lands on that button.
 *
 * It is both StepList.Item and an export of its own, the way Slide is to
 * SlideContainer.
 *
 * @type {import("preact").FunctionComponent<{
 *   value: string,
 *   done?: boolean,
 *   [key: string]: any,
 * }>}
 * @param {boolean} [done] - this step is answered: its dot is filled — the
 *   fill's one meaning. Steps answered out of order are filled dots
 *   standing alone, dashed segments around them.
 */
export const Step = ({ value, done, children, ...buttonProps }) => {
  const registry = useContext(StepListContext);
  if (registry) {
    registry.renderedSteps.push({
      value: value ?? String(registry.renderedSteps.length),
      done: Boolean(done),
      label: children,
      buttonProps,
    });
  }
  return null;
};

StepList.Item = Step;
