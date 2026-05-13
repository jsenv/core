import { createContext } from "preact";
import { useContext, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { Text } from "@jsenv/navi/src/text/text.jsx";
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
import { HourPicker } from "./picker_hour.jsx";
import { parseStepToSeconds } from "./time_helpers.js";

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
`;

/**
 * Picker — a button-like trigger that opens a browser-native or custom picker.
 *
 * The `type` prop selects the picker variant:
 *
 * Native browser pickers (via `showPicker()` on a hidden `<input>`):
 *   "day"      → <input type="date">         — calendar day (YYYY-MM-DD)
 *   "month"    → <input type="month">        — year + month (YYYY-MM)
 *   "week"     → <input type="week">         — ISO week (YYYY-Www)
 *   "time"     → <input type="time">         — hours + minutes (HH:MM)
 *   "datetime" → <input type="datetime-local"> — date + time (YYYY-MM-DDTHH:MM)
 *   "color"    → <input type="color">        — color chooser (#rrggbb)
 *
 * Custom Select-based picker:
 *   "hour"     → HourPicker — a Select showing fixed time slots derived from
 *                min/max/step; past slots are disabled when the selected day
 *                is today.
 *
 * Fully custom picker (no built-in input):
 *   (any other type, or no type) → bare PickerUI with a hidden input forwarded
 *   via the `inputType` prop.
 *
 * Common props:
 *   value       — current value string (format depends on type)
 *   uiAction    — called with the new value string when the user picks a value
 *   name        — form field name (on the hidden input for form submission)
 *   placeholder — shown when no value is selected
 *   disabled    — disables the picker
 *   min         — minimum value; accepts a Date (converted automatically) or
 *                 the raw input string
 *   max         — maximum value; same as min
 *   step        — step value forwarded to the underlying input
 *   children    — custom value display rendered when a value is selected
 *   ...rest     — forwarded to the outer <button> element
 */
export const Picker = (props) => {
  const defaultRef = useRef(null);
  const ref = props.ref || defaultRef;
  const fieldId = useFieldId();
  const id = props.id || fieldId;
  const uiStateController = useUIStateController(props, "picker");
  const uiState = useUIState(uiStateController);

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        <PickerDispatcher {...props} ref={ref} id={id} />
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};
const PickerDispatcher = (props) => {
  // "native" pickers
  if (props.type === "color") {
    return <PickerColor {...props} />;
  }
  if (props.type === "day") {
    return <PickerDay {...props} />;
  }
  if (props.type === "month") {
    return <PickerMonth {...props} />;
  }
  if (props.type === "week") {
    return <PickerWeek {...props} />;
  }
  if (props.type === "time") {
    return <PickerTime {...props} />;
  }
  if (props.type === "datetime") {
    return <PickerDatetime {...props} />;
  }
  // custom preset pickers
  if (props.type === "hour") {
    return <HourPicker {...props} />;
  }
  // fully custom picker
  return <PickerUI {...props} />;
};

const PickerValuePlaceholder = (props) => {
  return <Text className="navi_picker_placeholder" {...props} />;
};
const PickerContext = createContext();
const PickerUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    type,
    name,
    placeholder,
    ui,
    icon,
    inputType,
    disabled,
    readOnly,
    loading,
    autoFocus,
    autoFocusPreventScroll,
    onChange,
    // children,
    ...rest
  } = props;
  const uiState = useContext(UIStateContext);
  const uiStateController = useContext(UIStateControllerContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);

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

  return (
    <Box
      as="button"
      type="button"
      {...remainingProps}
      ref={ref}
      baseClassName="navi_picker"
      navi-type={type}
      navi-has-placeholder={placeholder ? "" : undefined}
      autoFocus={undefined}
      basePseudoState={{
        ...remainingProps.basePseudoState,
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      pseudoClasses={PICKER_PSEUDO_CLASSES}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (innerDisabled || innerReadOnly) {
          return;
        }
        rest.onMouseDown?.(e);
      }}
      onClick={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (innerDisabled || innerReadOnly) {
          return;
        }
        rest.onClick?.(e);
      }}
    >
      <LoadingOutline
        loading={innerLoading}
        color="var(--loader-color)"
        inset={-1}
      />
      <PickerContext.Provider value={{ placeholder, value: uiState }}>
        {ui}
      </PickerContext.Provider>
      <span className="navi_picker_right_slot">
        <Icon size="m">{icon}</Icon>
      </span>

      <input
        ref={pickerInputRef}
        className="navi_picker_input"
        type={inputType}
        name={name}
        value={uiState}
        tabIndex={-1}
        disabled={innerDisabled || innerReadOnly}
        data-rendered-by=".navi_picker"
        onChange={(e) => {
          const newValue = e.currentTarget.value;
          uiStateController.setUIState(newValue, e);
          onChange?.(e);
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

const onMouseDownForShowPicker = (props) => {
  return (e) => {
    e.preventDefault();
    const button = e.currentTarget;
    const inputEl = button.querySelector(".navi_picker_input");
    if (inputEl) {
      try {
        inputEl.showPicker();
      } catch {
        inputEl.click();
      }
    }
    props.onMouseDown?.(e);
  };
};

const PickerColor = (props) => {
  return (
    <PickerUI
      inputType="color"
      data-required-message={naviI18n(`picker.required.color`)}
      ui={<PickerColorUI />}
      icon={<ColorSvg />}
      {...props}
      onMouseDown={onMouseDownForShowPicker(props)}
    >
      {props.children}
    </PickerUI>
  );
};
const PickerColorUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (placeholder) {
      return <PickerValuePlaceholder>{placeholder}</PickerValuePlaceholder>;
    }
    return null;
  }
  return (
    <span
      className="navi_picker_color_display"
      style={{
        "--picker-color": value,
      }}
    />
  );
};

const PickerDay = (props) => {
  const min = resolveDateProp(props.min, toInputDay);
  const max = resolveDateProp(props.max, toInputDay);

  return (
    <PickerUI
      inputType="date"
      min={min}
      max={max}
      data-required-message={naviI18n(`picker.required.day`)}
      ui={<PickerDayUI />}
      icon={<CalendarSvg />}
      {...props}
      onMouseDown={onMouseDownForShowPicker(props)}
    >
      {props.children}
    </PickerUI>
  );
};
const PickerDayUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (placeholder) {
      return <PickerValuePlaceholder>{placeholder}</PickerValuePlaceholder>;
    }
    return null;
  }
  return (
    <Time type="day" capitalize>
      {value}
    </Time>
  );
};
const toInputDay = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const PickerMonth = (props) => {
  const min = resolveDateProp(props.min, toInputMonth);
  const max = resolveDateProp(props.max, toInputMonth);

  return (
    <PickerUI
      inputType="month"
      min={min}
      max={max}
      data-required-message={naviI18n(`picker.required.month`)}
      ui={<PickerMonthUI />}
      icon={<CalendarSvg />}
      {...props}
      onMouseDown={onMouseDownForShowPicker(props)}
    >
      {props.children}
    </PickerUI>
  );
};
const PickerMonthUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (placeholder) {
      return <PickerValuePlaceholder>{placeholder}</PickerValuePlaceholder>;
    }
    return null;
  }
  return (
    <Time type="month" capitalize>
      {value}
    </Time>
  );
};
const toInputMonth = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};
const PickerWeek = (props) => {
  const min = resolveDateProp(props.min, toInputWeek);
  const max = resolveDateProp(props.max, toInputWeek);

  return (
    <PickerUI
      inputType="week"
      min={min}
      max={max}
      data-required-message={naviI18n(`picker.required.week`)}
      ui={<PickerWeekUI />}
      icon={<CalendarSvg />}
      {...props}
      onMouseDown={onMouseDownForShowPicker(props)}
    >
      {props.children}
    </PickerUI>
  );
};
const PickerWeekUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (placeholder) {
      return <PickerValuePlaceholder>{placeholder}</PickerValuePlaceholder>;
    }
    return null;
  }
  return (
    <Time type="week" capitalize>
      {value}
    </Time>
  );
};
const toInputWeek = (date) => {
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
const PickerTime = (props) => {
  const min = resolveDateProp(props.min, toInputTime);
  const max = resolveDateProp(props.max, toInputTime);
  const step = parseStepToSeconds(props.step);

  return (
    <PickerUI
      inputType="time"
      min={min}
      max={max}
      step={step}
      data-required-message={naviI18n(`picker.required.time`)}
      ui={<PickerTimeUI />}
      icon={<ClockSvg />}
      {...props}
      onMouseDown={onMouseDownForShowPicker(props)}
    >
      {props.children}
    </PickerUI>
  );
};
const PickerTimeUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (placeholder) {
      return <PickerValuePlaceholder>{placeholder}</PickerValuePlaceholder>;
    }
    return null;
  }
  return <Time type="time">{value}</Time>;
};
const toInputTime = (date) => {
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
};
const PickerDatetime = (props) => {
  const min = resolveDateProp(props.min, toInputDatetime);
  const max = resolveDateProp(props.max, toInputDatetime);
  const step = parseStepToSeconds(props.step);

  return (
    <PickerUI
      inputType="datetime-local"
      min={min}
      max={max}
      step={step}
      data-required-message={naviI18n(`picker.required.datetime`)}
      ui={<PickerDatetimeUI />}
      icon={<CalendarSvg />}
      {...props}
      onMouseDown={onMouseDownForShowPicker(props)}
    >
      {props.children}
    </PickerUI>
  );
};
const PickerDatetimeUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (placeholder) {
      return <PickerValuePlaceholder>{placeholder}</PickerValuePlaceholder>;
    }
    return null;
  }
  return <Time type="datetime">{value}</Time>;
};
const toInputDatetime = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const resolveDateProp = (value, formatter) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value instanceof Date) {
    return formatter(value);
  }
  return value;
};
const CalendarSvg = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
    </svg>
  );
};
const ClockSvg = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
    </svg>
  );
};
const ColorSvg = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  );
};
