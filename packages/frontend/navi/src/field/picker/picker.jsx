import { useContext, useRef, useState } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import {
  reportDisabledToField,
  reportInteractiveToField,
  reportReadOnlyToField,
  useFieldId,
} from "../field.jsx";
import {
  DisabledContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "../use_ui_state_controller.js";
import { useConstraints } from "../validation/hooks/use_constraints.js";

const css = /* css */ `
  @layer navi {
    .navi_picker {
      --picker-border-radius: 2px;
      --picker-outline-width: 1px;
      --picker-border-width: 1px;
      --picker-font-size: 14px;
      --picker-padding-x-default: 8px;
      --picker-padding-y-default: 5px;
      --picker-outline-color: var(--navi-focus-outline-color);
      --picker-border-color: light-dark(#767676, #8e8e93);
      --picker-background-color: white;
      --picker-color: currentColor;
      --picker-placeholder-color: color-mix(
        in srgb,
        currentColor 60%,
        transparent
      );
      --picker-border-color-hover: color-mix(
        in srgb,
        var(--picker-border-color) 70%,
        black
      );
      --picker-background-color-hover: color-mix(
        in srgb,
        var(--picker-background-color) 95%,
        black
      );
      --picker-right-slot-size: 1.5em;
    }
  }

  .navi_picker {
    --x-picker-outline-width: calc(
      var(--picker-outline-width) + var(--picker-border-width)
    );
    --x-picker-outline-offset: calc(-1 * var(--picker-border-width));
    --x-picker-background-color: var(--picker-background-color);
    --x-picker-border-color: var(--picker-border-color);
    --x-picker-padding-top: var(
      --picker-padding-top,
      var(--picker-padding-y, var(--picker-padding-y-default))
    );
    --x-picker-padding-right-base: var(
      --picker-padding-right,
      var(--picker-padding-x, var(--picker-padding-x-default))
    );
    --x-picker-padding-right: calc(
      var(--x-picker-padding-right-base) + var(--picker-right-slot-size)
    );
    --x-picker-padding-left: var(
      --picker-padding-left,
      var(--picker-padding-x, var(--picker-padding-x-default))
    );
    --x-picker-padding-bottom: var(
      --picker-padding-bottom,
      var(--picker-padding-y, var(--picker-padding-y-default))
    );

    position: relative;
    display: inline-flex;
    box-sizing: border-box;
    min-height: 1em;
    padding-top: var(--x-picker-padding-top);
    padding-right: var(--x-picker-padding-right);
    padding-bottom: var(--x-picker-padding-bottom);
    padding-left: var(--x-picker-padding-left);
    flex-direction: column;
    justify-content: center;
    color: var(--picker-color);
    font-size: var(--picker-font-size);
    text-align: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;
    background-color: var(--x-picker-background-color);
    border-width: var(--picker-border-width);
    border-style: solid;
    border-color: var(--x-picker-border-color);
    border-radius: var(--picker-border-radius);
    outline-width: var(--x-picker-outline-width);
    outline-color: var(--picker-outline-color);
    outline-offset: var(--x-picker-outline-offset);
    cursor: pointer;
    user-select: none;
    overflow: hidden;

    &[data-hover] {
      --x-picker-background-color: var(--picker-background-color-hover);
      --x-picker-border-color: var(--picker-border-color-hover);
    }
    &[data-focus-visible] {
      --x-picker-border-color: transparent;
      outline-style: solid;
    }
    &[data-focus-within] {
      --x-picker-border-color: transparent;
      outline-style: solid;
    }
    &[data-expanded] {
      --x-picker-border-color: transparent;
      outline-style: solid;
    }
    &[data-disabled] {
      opacity: 0.5;
      cursor: default;
    }
    &[data-callout] {
      --x-picker-border-color: var(--callout-color);
    }

    .navi_picker_placeholder {
      color: var(--picker-placeholder-color);
      &[hidden] {
        display: inline-block !important;
        height: 0;
        padding-block: 0;
        visibility: hidden;
      }
    }
    &[navi-type="color"] {
      .navi_picker_value {
        /* In case there is no placeholder */
        min-width: 1em;
        min-height: 1em;
      }

      &[navi-has-placeholder] {
        .navi_picker_value {
          min-height: auto;
        }

        .navi_picker_placeholder {
          &[hidden] {
            /* Color display is absolute, keep placeholder in place */
            height: auto;
          }
        }
      }

      .navi_picker_color_display {
        position: absolute;
        top: var(--x-picker-padding-top);
        right: var(--x-picker-padding-right);
        bottom: var(--x-picker-padding-bottom);
        left: var(--x-picker-padding-left);
        display: block;
        background-color: var(--picker-color);
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 2px;
      }
    }

    .navi_picker_value {
    }
    .navi_picker_right_slot {
      position: absolute;
      right: 0;
      width: var(--picker-right-slot-size);
      flex-shrink: 0;
      opacity: 0.6;
    }
    .navi_picker_input {
      position: absolute;
      inset: 0;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: none;
      border: none;
      opacity: 0;
      cursor: pointer;
    }
  }
`;

/**
 * Picker — a button-like trigger that opens the browser's native picker
 * (date, time, month, week, datetime-local, color) via showPicker().
 *
 * Props:
 *   type        — picker type: "day" | "month" | "week" | "time" | "datetime" | "color"
 *                 Defaults to "day". Maps to the corresponding <input type=…>.
 *   value       — current value string (same format as the underlying input)
 *   uiAction    — called with the new value string when the user picks a value
 *   name        — form field name (on the underlying input for form submission)
 *   placeholder — shown when no value. If a string it is styled; otherwise rendered as-is.
 *   disabled    — disables the picker
 *   min         — min value forwarded to the underlying input
 *   max         — max value forwarded to the underlying input
 *   step        — step forwarded to the underlying input
 *   children    — custom value display. If omitted, the default display for the type is used.
 *   ...rest     — forwarded to the outer <button> element
 */
export const Picker = (props) => {
  const defaultRef = useRef(null);
  const ref = props.ref || defaultRef;
  const uiStateController = useUIStateController(props, "picker");
  const uiState = useUIState(uiStateController);

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        <PickerUI {...props} ref={ref} />
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const PickerUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    id,
    type = "day",
    name,
    placeholder,
    disabled,
    readOnly,
    loading,
    autoFocus,
    autoFocusPreventScroll,
    min,
    max,
    step,
    children,
    ...rest
  } = props;
  const uiState = useContext(UIStateContext);
  const uiStateController = useContext(UIStateControllerContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);

  const fieldId = useFieldId();
  const innerId = id || fieldId;

  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;

  reportReadOnlyToField(innerReadOnly);
  reportDisabledToField(innerDisabled);
  reportInteractiveToField(true);
  useAutoFocus(ref, autoFocus, { preventScroll: autoFocusPreventScroll });

  const pickerInputRef = useRef(null);
  const remainingProps = useConstraints(pickerInputRef, rest);

  const inputType = TYPE_TO_INPUT_TYPE[type] || "date";
  const hasValue = uiState !== undefined && uiState !== "" && uiState !== null;
  const [expanded, setExpanded] = useState(false);

  const showColorSwatchAlways = type === "color" && !placeholder && !children;

  return (
    <Box
      as="button"
      type="button"
      {...remainingProps}
      ref={ref}
      id={innerId}
      baseClassName="navi_picker"
      navi-type={type}
      navi-has-placeholder={placeholder ? "" : undefined}
      data-callout-arrow-x="center"
      autoFocus={undefined}
      basePseudoState={{
        ...remainingProps.basePseudoState,
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
        ":-navi-expanded": expanded,
      }}
      pseudoClasses={PICKER_PSEUDO_CLASSES}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (innerDisabled || innerReadOnly) {
          return;
        }
        e.preventDefault();
        rest.onMouseDown?.(e);
      }}
      onClick={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (innerDisabled || innerReadOnly) {
          return;
        }
        const inputEl = ref.current?.querySelector(".navi_picker_input");
        if (inputEl) {
          try {
            inputEl.showPicker();
          } catch {
            inputEl.click();
          }
        }
        rest.onClick?.(e);
      }}
    >
      <LoadingOutline
        loading={innerLoading}
        color="var(--loader-color)"
        inset={-1}
      />
      <span className="navi_picker_placeholder" hidden={hasValue}>
        {placeholder}
      </span>
      <span
        className="navi_picker_value"
        hidden={!hasValue && !showColorSwatchAlways}
      >
        {children ? (
          children
        ) : (
          <DefaultValueDisplay
            type={type}
            value={hasValue ? uiState : "#000000"}
          />
        )}
      </span>
      <span className="navi_picker_right_slot">
        <Icon size="m">{ICON_FOR_TYPE[type] || <CalendarSvg />}</Icon>
      </span>

      <input
        ref={pickerInputRef}
        className="navi_picker_input"
        type={inputType}
        name={name}
        value={uiState}
        min={formatInputMin(type, min)}
        max={formatInputMax(type, max)}
        step={step}
        required={rest.required}
        tabIndex={-1}
        disabled={innerDisabled || innerReadOnly}
        data-rendered-by=".navi_picker"
        onChange={(e) => {
          const newValue = e.currentTarget.value;
          uiStateController.setUIState(newValue, e);
          setExpanded(false);
        }}
        onFocus={() => {
          setExpanded(true);
        }}
        onBlur={() => {
          setExpanded(false);
        }}
      />
    </Box>
  );
};

const PICKER_PSEUDO_CLASSES = [
  ":hover",
  ":focus",
  ":focus-visible",
  ":focus-within",
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":-navi-expanded",
  ":-navi-has-value",
];

const TYPE_TO_INPUT_TYPE = {
  day: "date",
  month: "month",
  week: "week",
  time: "time",
  datetime: "datetime-local",
  color: "color",
};

const DefaultValueDisplay = ({ type, value }) => {
  if (type === "color") {
    return (
      <span
        className="navi_picker_color_display"
        style={{
          "--picker-color": value,
        }}
      />
    );
  }
  if (timeTypeSet.has(type)) {
    return (
      <Time
        type={type === "week" ? null : type}
        capitalize={type === "day" || type === "month"}
      >
        {value}
      </Time>
    );
  }
  return value;
};

const timeTypeSet = new Set(["day", "month", "week", "time", "datetime"]);

const formatInputMin = (type, min) => {
  if (min === undefined || min === null) {
    return undefined;
  }
  if (min instanceof Date) {
    return toInputValue(type, min);
  }
  return min;
};

const formatInputMax = (type, max) => {
  if (max === undefined || max === null) {
    return undefined;
  }
  if (max instanceof Date) {
    return toInputValue(type, max);
  }
  return max;
};

const toInputValue = (type, date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  if (type === "day") {
    return `${yyyy}-${mm}-${dd}`;
  }
  if (type === "month") {
    return `${yyyy}-${mm}`;
  }
  if (type === "week") {
    return toWeekString(date);
  }
  if (type === "time") {
    return `${hh}:${min}`;
  }
  if (type === "datetime") {
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
  return String(date);
};

const toWeekString = (date) => {
  // ISO week number
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const week =
    Math.round(
      ((d - yearStart) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7,
    ) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const ICON_FOR_TYPE = {
  color: <ColorSvg />,
  time: <ClockSvg />,
  datetime: <ClockSvg />,
};

function CalendarSvg() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
    </svg>
  );
}

function ClockSvg() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
    </svg>
  );
}

function ColorSvg() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  );
}
