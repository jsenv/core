import { SPAForm } from "./spa_form.jsx";
import { useRef, useLayoutEffect } from "preact/hooks";
import { useOptimisticUIState } from "./use_optimistic_ui_state.js";
import { useSPAFormStatus } from "../hooks/use_spa_form_status.js";
import "./spa_checkbox.css" with { type: "css" };

export const SPACheckbox = ({ action, method = "PUT", ...rest }) => {
  return (
    <SPAForm action={action} method={method}>
      <SPACheckboxInput {...rest} />
    </SPAForm>
  );
};

const SPACheckboxInput = ({ label, checked, ...rest }) => {
  const { pending } = useSPAFormStatus();
  const [optimisticUIState, setOptimisticUIState] =
    useOptimisticUIState(checked);
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    if (pending) {
      // show the loading stuff, ensure we match checkbox size and color somehow
    }
  }, [pending]);

  const input = (
    <div style="display:inline-flex;position: relative; ">
      {pending ||
        (true && (
          <div style="position: absolute; inset: 0">
            <RectangleLoading />
          </div>
        ))}
      <input
        ref={inputRef}
        style="position: relative;"
        className="spa_checkbox"
        type="checkbox"
        name="value"
        onChange={(e) => {
          setOptimisticUIState(e.target.checked);
          const form = e.target.form;
          form.requestSubmit();
        }}
        {...rest}
        checked={optimisticUIState}
        disabled={pending}
      />
    </div>
  );

  if (label) {
    return (
      <label>
        {label}
        {input}
      </label>
    );
  }
  return input;
};

const RectangleLoading = ({ color = "#383a36", radius = 0 }) => {
  // Calculate the perimeter of the rectangle
  const pathLength = 2 * (38 + 38) + 2 * Math.PI * radius; // Approximation for rounded corners

  return (
    <svg
      viewBox="0 0 40 40"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Primary animation - short segment rotating around */}
      <path
        d={`
          M ${1 + radius},1
          L ${39 - radius},1
          A ${radius},${radius} 0 0 1 39,${1 + radius}
          L 39,${39 - radius}
          A ${radius},${radius} 0 0 1 ${39 - radius},39
          L ${1 + radius},39
          A ${radius},${radius} 0 0 1 1,${39 - radius}
          L 1,${1 + radius}
          A ${radius},${radius} 0 0 1 ${1 + radius},1
        `}
        fill="none"
        stroke={color}
        opacity={0.6}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={`${pathLength * 0.1} ${pathLength * 0.9}`}
        strokeDashoffset="0"
      >
        <animate
          attributeName="stroke-dashoffset"
          from={pathLength}
          to="0"
          dur="2s"
          repeatCount="indefinite"
        />
      </path>

      {/* Secondary animation - opposite direction, different size */}
      <path
        d={`
          M ${1 + radius},1
          L ${39 - radius},1
          A ${radius},${radius} 0 0 1 39,${1 + radius}
          L 39,${39 - radius}
          A ${radius},${radius} 0 0 1 ${39 - radius},39
          L ${1 + radius},39
          A ${radius},${radius} 0 0 1 1,${39 - radius}
          L 1,${1 + radius}
          A ${radius},${radius} 0 0 1 ${1 + radius},1
        `}
        fill="none"
        stroke={color}
        opacity={0.4}
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray={`${pathLength * 0.05} ${pathLength * 0.95}`}
        strokeDashoffset="0"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={pathLength}
          dur="3s"
          repeatCount="indefinite"
        />
      </path>

      {/* Optional background rectangle (very light outline) */}
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        fill="none"
        stroke="rgba(0,0,0,0.03)"
        strokeWidth="1"
        rx={radius}
      />
    </svg>
  );
};
