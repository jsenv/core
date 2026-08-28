// Rulers around an element, and the delta between two of them: what it takes
// to say "these two states are the same box" with a number rather than an
// impression. Used wherever a control must not change size when its value
// arrives (an input that gains a clear button, a textarea showing a
// placeholder).

import { useLayoutEffect, useRef, useState } from "preact/hooks";

const formatPx = (value) => {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}px`;
};

const MEASURE_COLOR = "#d6336c";
const MEASURE_GAP = 8;
const MEASURE_TICK = 10;

// Wraps a single element and draws dotted rulers with its exact rendered
// width and height, so two states can be compared pixel per pixel.
export const Measured = ({ onMeasure, children }) => {
  const wrapperRef = useRef(null);
  const [size, setSize] = useState(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const element = wrapper.firstElementChild;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const nextSize = { width: rect.width, height: rect.height };
      setSize((currentSize) => {
        if (
          currentSize &&
          currentSize.width === nextSize.width &&
          currentSize.height === nextSize.height
        ) {
          return currentSize;
        }
        return nextSize;
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (size && onMeasure) {
      onMeasure(size);
    }
  }, [size, onMeasure]);

  const tickStyle = {
    position: "absolute",
    background: "none",
    borderColor: MEASURE_COLOR,
    borderStyle: "dotted",
    borderWidth: 0,
  };
  const labelStyle = {
    position: "absolute",
    fontSize: "11px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    color: MEASURE_COLOR,
    background: "#fff",
    padding: "0 3px",
    whiteSpace: "nowrap",
    lineHeight: "14px",
  };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        marginBottom: `${MEASURE_GAP + MEASURE_TICK + 16}px`,
        marginRight: "90px",
      }}
    >
      <div ref={wrapperRef} style={{ display: "inline-block" }}>
        {children}
      </div>
      {size && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
        >
          {/* width ruler, below the element */}
          <div
            style={{
              ...tickStyle,
              left: 0,
              top: `${-MEASURE_TICK}px`,
              height: `calc(100% + ${MEASURE_GAP + MEASURE_TICK * 2}px)`,
              borderLeftWidth: "1px",
            }}
          />
          <div
            style={{
              ...tickStyle,
              left: "100%",
              top: `${-MEASURE_TICK}px`,
              height: `calc(100% + ${MEASURE_GAP + MEASURE_TICK * 2}px)`,
              borderLeftWidth: "1px",
            }}
          />
          <div
            style={{
              ...tickStyle,
              left: 0,
              width: "100%",
              top: `calc(100% + ${MEASURE_GAP + MEASURE_TICK}px)`,
              borderTopWidth: "1px",
            }}
          />
          <div
            style={{
              ...labelStyle,
              left: "50%",
              top: `calc(100% + ${MEASURE_GAP + MEASURE_TICK}px)`,
              transform: "translate(-50%, -50%)",
            }}
          >
            w {formatPx(size.width)}
          </div>

          {/* height ruler, on the right of the element */}
          <div
            style={{
              ...tickStyle,
              top: 0,
              left: `${-MEASURE_TICK}px`,
              width: `calc(100% + ${MEASURE_GAP + MEASURE_TICK * 2}px)`,
              borderTopWidth: "1px",
            }}
          />
          <div
            style={{
              ...tickStyle,
              top: "100%",
              left: `${-MEASURE_TICK}px`,
              width: `calc(100% + ${MEASURE_GAP + MEASURE_TICK * 2}px)`,
              borderTopWidth: "1px",
            }}
          />
          <div
            style={{
              ...tickStyle,
              top: 0,
              height: "100%",
              left: `calc(100% + ${MEASURE_GAP + MEASURE_TICK}px)`,
              borderLeftWidth: "1px",
            }}
          />
          <div
            style={{
              ...labelStyle,
              top: "50%",
              left: `calc(100% + ${MEASURE_GAP + MEASURE_TICK}px)`,
              transform: "translate(-50%, -50%)",
            }}
          >
            h {formatPx(size.height)}
          </div>
        </div>
      )}
    </div>
  );
};

// Reads the two measurements and tells whether both states match.
export const MeasureDelta = ({ a, b, labelA, labelB }) => {
  if (!a || !b) {
    return null;
  }
  const widthDelta = Math.round((b.width - a.width) * 100) / 100;
  const heightDelta = Math.round((b.height - a.height) * 100) / 100;
  const pixelPerfect = widthDelta === 0 && heightDelta === 0;
  return (
    <div
      style={{
        marginTop: "8px",
        fontSize: "12px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        color: pixelPerfect ? "#2b8a3e" : "#c92a2a",
      }}
    >
      {labelB} − {labelA}: Δw {widthDelta > 0 ? "+" : ""}
      {widthDelta}px · Δh {heightDelta > 0 ? "+" : ""}
      {heightDelta}px {pixelPerfect ? "✓ pixel perfect" : "✗ mismatch"}
    </div>
  );
};
