/**
 * Where one stands in a walk of steps, drawn as dots on a path.
 *
 * Two distinct facts, drawn separately — they usually agree, and everything
 * this component says comes from the moments they do not:
 *
 * - the PATH (`reached`): how far the steps are answered without a gap. A
 *   solid line runs from the first dot to the step it names, and those dots
 *   are filled; past it the line is dashed — the road not walked yet. It
 *   moves when a step is answered, not when one merely looks around.
 * - the POSITION (`current`): the step being looked at, marked by a halo
 *   around its dot and its label emphasized. It travels freely, so it can be
 *   AHEAD of the path (browsing step 3 while step 1 still misses an answer)
 *   or BEHIND it (back on step 1 to change something already answered).
 *
 * Both move smoothly on change (a CSS transition each), so pressing a step
 * or answering one is seen travelling rather than jumping.
 *
 * The dots are drawn in SVG, twice: a muted layer, and a filled layer
 * clipped at the path's edge — the clip is what makes the path's progress a
 * single sweep that fills the line and the dots it crosses in one movement.
 * The line is drawn as segments between the dots (never behind them), so the
 * dots need no background of their own and the component sits on any
 * surface. Colors are CSS custom properties (see the css below), overridden
 * from outside for a dark band or a different accent.
 *
 * The steps are the CHILDREN — <StepList.Item value="club">Club</StepList.Item>
 * — read off the vnodes (toChildArray, so a .map() or a fragment is fine; a
 * component of your own wrapping an Item is not seen). The Item renders its
 * label; everything positional is this component's business.
 *
 * `slideContainer` connects the list to a <SlideContainer> by id, both ways:
 * pressing a step travels there (--navi-go-to-slide), and the position is
 * READ off the container rather than said by a prop — including mid-travel:
 * the container paints --slide-travel-progress on this element (it is a
 * follower, same mechanism as <Nav slideContainer>), so the halo rides the
 * drag under the finger, in CSS alone. The path then follows the position
 * too, clamped between `reached` (never retracts) and `reachable` (never
 * ahead of the answers): dragging towards a step whose way is earned fills
 * the line under the finger, dragging past the answers does not.
 */

import { toChildArray } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { Button } from "../control/input/button.jsx";

const css = /* css */ `
  .navi_step_list {
    /* The knobs, in one place: accent is the path, muted is what the path
       has not reached, on-accent writes on filled dots. --step-list-path-line
       exists apart from the accent for a dark band where the walked line
       reads better plain white. */
    --step-list-accent: #4f8ef7;
    --step-list-on-accent: white;
    --step-list-muted: light-dark(#8a93a8, #8b99b8);
    --step-list-line: light-dark(#c9d0dd, rgba(255, 255, 255, 0.35));
    --step-list-current-color: light-dark(#1c2433, white);
    --step-list-path-line: var(--step-list-accent);

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
    stroke: var(--step-list-line);
    stroke-width: 2;
    stroke-dasharray: 4 5;
  }
  .navi_step_list_rail circle {
    fill: none;
    stroke: var(--step-list-muted);
    stroke-width: 1.5;
  }
  .navi_step_list_rail text {
    font-weight: 600;
    font-size: 12px;
    fill: var(--step-list-muted);
  }
  /* The current dot says so in the drawing itself, not only by its halo: on
     a dark band a muted number under a faint ring reads as nothing. Said in
     the base layer only (see renderRail) — a current dot the path has
     covered keeps the filled colors. */
  .navi_step_list_rail g[data-current] circle {
    stroke: var(--step-list-current-color);
  }
  .navi_step_list_rail g[data-current] text {
    fill: var(--step-list-current-color);
  }
  /* The path: same drawing, filled, revealed up to the step it has come to.
     The clip is set inline (a width in px); transitioning it is what makes
     an answered step SWEEP the line and the next dot rather than pop. */
  .navi_step_list_rail_filled {
    transition: clip-path 300ms ease;
  }
  .navi_step_list_rail_filled line {
    stroke: var(--step-list-path-line);
    stroke-dasharray: none;
  }
  .navi_step_list_rail_filled circle {
    fill: var(--step-list-accent);
    stroke: var(--step-list-accent);
  }
  .navi_step_list_rail_filled text {
    fill: var(--step-list-on-accent);
  }
  /* The position: a halo around the dot being looked at. It slides from dot
     to dot (transform, transitioned) — the g moves, the circle inside is
     drawn at x=0. */
  .navi_step_list_marker {
    transition: transform 300ms ease;
  }
  .navi_step_list_marker circle {
    fill: none;
    stroke: color-mix(in srgb, var(--step-list-accent) 65%, transparent);
    stroke-width: 1.5;
  }

  /* Connected to slides: the movement is not this component's anymore. The
     container paints --slide-travel-progress here (this element follows it,
     see data-slide-container-follows) — an asked-for travel animates it, a
     finger drags it — and everything below is a calc() of that number, so
     the halo and the path move per frame in CSS alone. The transitions are
     off: they would chase a finger that is already the pace.
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
  /* The path follows the position, clamped: never back below what was
     earned (--step-list-reached-x), never ahead of what the answers allow
     (--step-list-reachable-x). The +14 covers the dot it stands on (radius
     plus stroke). */
  .navi_step_list[data-slide-container-follows] .navi_step_list_rail_filled {
    clip-path: inset(
      0
        calc(
          (
              var(--step-list-w, 0) -
                (
                  clamp(
                      var(--step-list-reached-x, -9999),
                      var(--step-list-position),
                      var(--step-list-reachable-x, -9999)
                    ) +
                    14
                )
            ) *
            1px
        )
        0 0
    );
    transition: none;
  }

  /* One press target per step, covering the dot AND the label under it. The
     feedback is NOT the whole surface: a rectangle would say the whole band
     is a button, when the affordance is the dot — so hover and focus land on
     a circle drawn over the dot (::before), plus the label brightening.
     --step-dot-x anchors both on the dot, wherever the dot sits in the slot:
     the first and last slots are asymmetric (cut at the container's edge,
     see the geometry in the component). */
  .navi_step_list_slot {
    position: absolute;
    top: 0;
    box-sizing: border-box;
    height: 100%;
  }
  /* Doubled selector: the discrete variant declares its own hover background
     var, and navi's stylesheet is injected after this one — specificity is
     what makes these values the ones read. */
  .navi_step_list .navi_step_list_step {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    font-size: 12px;
    outline: none;
    --button-color: var(--step-list-muted);
    --button-color-readonly: var(--step-list-muted);
    --button-background-color: transparent;
    --button-background-color-hover: transparent;
    --button-background-color-readonly: transparent;
  }
  /* Centered on the dot: same vertical middle as the rail (top 0, height 34,
     cy 17). */
  .navi_step_list_step::before {
    position: absolute;
    top: 17px;
    left: var(--step-dot-x);
    width: 30px;
    height: 30px;
    border-radius: 50%;
    translate: -50% -50%;
    content: "";
  }
  .navi_step_list_step:hover::before,
  .navi_step_list_step[data-hover]::before {
    background: color-mix(in srgb, var(--step-list-accent) 15%, transparent);
  }
  .navi_step_list .navi_step_list_step:hover,
  .navi_step_list .navi_step_list_step[data-hover] {
    --button-color: var(--step-list-current-color);
  }
  .navi_step_list_step:focus-visible::before,
  .navi_step_list_step[data-focus-visible]::before {
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
    --button-color: var(--step-list-current-color);
    --button-color-readonly: var(--step-list-current-color);
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

/**
 * @type {import("preact").FunctionComponent<{
 *   current?: string,
 *   reached?: string,
 *   reachable?: string,
 *   slideContainer?: string,
 *   onStepPress?: (value: string, event: Event) => void,
 *   [key: string]: any,
 * }>}
 * @param {string} [current] - the step being looked at: its dot gets the
 *   halo, its label the emphasis. Omit for "nowhere" — a confirmation
 *   screen after the walk, say. With `slideContainer` the position is read
 *   off the container instead, and this prop is ignored.
 * @param {string} [reached] - the step the path has come to: the line is
 *   solid and the dots filled up to it, dashed past it. Omit for a path
 *   that has not started.
 * @param {string} [reachable] - how far the path MAY go (with
 *   `slideContainer` only): between `reached` and this step the path
 *   follows the position — a drag towards a step whose way is earned fills
 *   the line under the finger. Defaults to `reached`: the path then never
 *   moves with the position at all.
 * @param {string} [slideContainer] - id of a <SlideContainer> these steps
 *   are the slides of. Pressing a step travels there
 *   (--navi-go-to-slide), the halo follows the container — drags included —
 *   and this element becomes a follower of the container
 *   (data-slide-container-follows), which is also what keeps the arrow keys
 *   working from here.
 * @param {(value: string, event: Event) => void} [onStepPress] - a step was
 *   pressed. Without it (and without `slideContainer`) the steps are
 *   read-only — shown, not offered.
 */
export const StepList = ({
  current,
  reached,
  reachable,
  slideContainer,
  onStepPress,
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

  // The steps, read off the children: each <StepList.Item> vnode says which
  // step it is (value) and is rendered as the label under its dot.
  const stepVNodes = toChildArray(children).filter(
    (child) => child && child.props,
  );
  const stepCount = stepVNodes.length;
  const valueOf = (vnode, index) => vnode.props.value ?? String(index);
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
  const indexOf = (value) =>
    stepVNodes.findIndex((vnode, index) => valueOf(vnode, index) === value);

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
  const reachedIndex = reached === undefined ? -1 : indexOf(reached);
  let reachableIndex = reachable === undefined ? -1 : indexOf(reachable);
  if (reachableIndex < reachedIndex) {
    reachableIndex = reachedIndex;
  }
  // Covers the reached dot entirely (radius plus stroke), and nothing when
  // the path has not started.
  const fillX = reachedIndex === -1 ? 0 : dotXs[reachedIndex] + DOT_R + 3;
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
        filled && !slideContainer
          ? { clipPath: `inset(0 ${width - fillX}px 0 0)` }
          : undefined
      }
      width={width}
      height={RAIL_H}
      viewBox={`0 0 ${width} ${RAIL_H}`}
      aria-hidden="true"
    >
      {dotXs.map((x, index) => (
        <g
          key={valueOf(stepVNodes[index], index)}
          // Base layer only: a current dot the path covers keeps the filled
          // colors (see the css).
          data-current={!filled && index === currentIndex ? "" : undefined}
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
        ...(slideContainer
          ? {
              "--step-list-w": width,
              "--step-list-reached-x":
                reachedIndex === -1 ? -9999 : dotXs[reachedIndex],
              "--step-list-reachable-x":
                reachableIndex === -1 ? -9999 : dotXs[reachableIndex],
            }
          : undefined),
      }}
    >
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
          {stepVNodes.map((stepVNode, index) => {
            const value = valueOf(stepVNode, index);
            // Whatever else the Item was given reaches its button — a
            // pseudoState held for a demo, an aria attribute.
            const itemRest = { ...stepVNode.props };
            delete itemRest.value;
            delete itemRest.children;
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
                key={value}
                className="navi_step_list_slot"
                style={{
                  "left": `${slotLeft}px`,
                  "width": `${slotRight - slotLeft}px`,
                  "--step-dot-x": `${dotXs[index] - slotLeft}px`,
                }}
              >
                <Button
                  {...itemRest}
                  variant="discrete"
                  className="navi_step_list_step"
                  aria-current={index === currentIndex ? "step" : undefined}
                  data-current={index === currentIndex ? "" : undefined}
                  readOnly={!onStepPress && !slideContainer}
                  // Towards the slides when connected, by name: the command
                  // reaches the container wherever this list sits on the
                  // page.
                  command={
                    slideContainer ? `--navi-go-to-slide:${value}` : undefined
                  }
                  commandFor={slideContainer}
                  onClick={
                    onStepPress
                      ? (e) => {
                          onStepPress(value, e);
                        }
                      : undefined
                  }
                >
                  <span className="navi_step_list_label">{stepVNode}</span>
                </Button>
              </div>
            );
          })}
        </>
      ) : null}
    </Box>
  );
};

/**
 * One step of the walk: `value` names it (what `current`/`reached` say and
 * what a press reports), the children are its label. Rendered under its dot;
 * where the dot is, and what state it shows, is the StepList's business.
 *
 * It is both StepList.Item and an export of its own, the way Slide is to
 * SlideContainer.
 *
 * @type {import("preact").FunctionComponent<{
 *   value: string,
 *   [key: string]: any,
 * }>}
 */
export const Step = ({ children }) => children;

StepList.Item = Step;
