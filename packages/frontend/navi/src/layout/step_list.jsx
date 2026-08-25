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
  /* One press target per step, covering the dot AND the label under it: the
     button is the slot's whole surface, with the label sitting at the
     bottom of it. */
  .navi_step_list_slot {
    position: absolute;
    top: 0;
    display: flex;
    box-sizing: border-box;
    height: 100%;
  }
  .navi_step_list_step {
    display: flex;
    width: 100%;
    padding-bottom: 6px;
    align-items: flex-end;
    justify-content: center;
    font-size: 12px;
    --button-color: var(--step-list-muted);
    --button-color-readonly: var(--step-list-muted);
    --button-background-color-hover: transparent;
    --button-background-color-readonly: transparent;
  }
  .navi_step_list_step[data-current] {
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
 *   onStepPress?: (value: string, event: Event) => void,
 *   [key: string]: any,
 * }>}
 * @param {string} [current] - the step being looked at: its dot gets the
 *   halo, its label the emphasis. Omit for "nowhere" — a confirmation
 *   screen after the walk, say.
 * @param {string} [reached] - the step the path has come to: the line is
 *   solid and the dots filled up to it, dashed past it. Omit for a path
 *   that has not started.
 * @param {(value: string, event: Event) => void} [onStepPress] - a step was
 *   pressed. Without it the steps are read-only — shown, not offered.
 */
export const StepList = ({
  current,
  reached,
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
  const currentIndex = current === undefined ? -1 : indexOf(current);
  const reachedIndex = reached === undefined ? -1 : indexOf(reached);
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
        filled ? { clipPath: `inset(0 ${width - fillX}px 0 0)` } : undefined
      }
      width={width}
      height={RAIL_H}
      viewBox={`0 0 ${width} ${RAIL_H}`}
      aria-hidden="true"
    >
      {dotXs.map((x, index) => (
        <g key={valueOf(stepVNodes[index], index)}>
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
                style={{ transform: `translateX(${dotXs[currentIndex]}px)` }}
              >
                <circle cx="0" cy={cy} r={RING_R} />
              </g>
            </svg>
          ) : null}
          {stepVNodes.map((stepVNode, index) => {
            const value = valueOf(stepVNode, index);
            return (
              <div
                key={value}
                className="navi_step_list_slot"
                style={{
                  left: `${dotXs[index] - slotWidth / 2}px`,
                  width: `${slotWidth}px`,
                }}
              >
                <Button
                  variant="discrete"
                  className="navi_step_list_step"
                  aria-current={index === currentIndex ? "step" : undefined}
                  data-current={index === currentIndex ? "" : undefined}
                  readOnly={!onStepPress}
                  onClick={
                    onStepPress
                      ? (e) => {
                          onStepPress(value, e);
                        }
                      : undefined
                  }
                >
                  {stepVNode}
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
