/**
 * SplitButton — one action, several variants of it.
 *
 * The left half does the thing; the right half opens the list of the other
 * ways of doing it. What choosing means is the caller's call (`chooseEffect`):
 * the chosen way becomes what the button does, or it is done right away.
 *
 * Both halves are `<Button>`s, deliberately: the chevron half has to wear the
 * exact same paint as the label half for any `cta`/`variant`/`color` the
 * caller passes, and a `<Picker variant="icon">` next to a button paints from
 * its own set of custom properties — matching them would mean restating the
 * button's palette here and keeping the copy in step forever. So the popup
 * comes from a headless `<Picker>` sitting behind the chevron button, hung off
 * the whole split button (`anchor`) so the menu lines up with it.
 *
 * The busy state is worn by the control, not by the half that happens to be
 * running: one loading outline around both, which is why each half is told
 * `loadingOutline={false}`.
 */

import { useId, useRef, useState } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { useActionStatus } from "@jsenv/navi/src/action/use_action_status.js";
import { Group } from "../group.jsx";
import { List } from "../list/list.jsx";
import { Picker } from "../picker/picker.jsx";
import { Button } from "./button.jsx";

const css = /* css */ `
  /* Around the pair rather than in it: the outline is drawn against this
     element and follows its corners, and a Group counts its own children to
     know which corners to square — an outline among them would be one of the
     halves. Hence a box holding a group, rather than the group itself. */
  .navi_split_button {
    position: relative;
    display: inline-flex;
    border-radius: var(--navi-control-border-radius);

    > .navi_group {
      flex: 1 1 auto;
    }
  }
  /* The chevron half is a button with a headless picker behind it: the picker
     box is inset: 0 of whatever is positioned above it, and that must be the
     chevron alone, not the whole split button. */
  .navi_split_button_menu {
    position: relative;
    display: flex;
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   options: Array<{value: any, label: import("preact").ComponentChildren, [key: string]: any}>,
 *   value?: any,
 *   defaultValue?: any,
 *   label?: import("preact").ComponentChildren,
 *   action?: (value: any, event: Event) => void | Promise<void>,
 *   onValueChange?: (value: any, event: Event) => void,
 *   chooseEffect?: "select" | "run",
 *   menuLabel?: string,
 *   menuIcon?: import("preact").ComponentChildren,
 *   menuIconSize?: number | string,
 *   loading?: boolean,
 *   readOnly?: boolean,
 *   disabled?: boolean,
 *   cta?: boolean,
 *   variant?: string,
 *   color?: string,
 *   backgroundColor?: string,
 *   borderColor?: string,
 *   borderWidth?: number | string,
 *   borderRadius?: number | string,
 *   pressEffect?: "none" | string,
 *   mode?: "popover" | "dialog",
 *   popoverMode?: "nearby" | "overlay",
 *   positionArea?: string,
 *   popupWidthFitContent?: boolean,
 *   popoverMaxHeight?: number | string,
 *   dialogMaxWidth?: number | string,
 *   dialogMaxHeight?: number | string,
 *   dialogExpand?: boolean,
 *   dialogExpandX?: boolean,
 *   dialogExpandY?: boolean,
 *   dockedOnSmallTouchScreen?: boolean,
 *   marginWithContainer?: number | string,
 *   backdropVariant?: "auto" | "discrete" | "invisible",
 *   pointerInteractionOutsideEffect?: "close" | "cancel" | "capture",
 *   escapeEffect?: "cancel" | "close",
 *   popupLayer?: "top" | "local",
 *   [key: string]: any,
 * }>}
 * @param {Array<{value: any, label: import("preact").ComponentChildren}>} options
 *   The ways of doing the thing, in the order the menu lists them. Anything
 *   else on an entry (`disabled`, `icon`, `padding`…) reaches its row.
 * @param {any} [value] Which entry the button stands for — the one it runs, and
 *   the one it is named after. `defaultValue` is the uncontrolled form; without
 *   either, the first entry.
 * @param {import("preact").ComponentChildren} [label] What the button says, when
 *   that is not the name of the entry it stands for — a button that keeps one
 *   name whatever the menu does.
 * @param {(value: any, event: Event) => void} [action] Do the thing, for the
 *   entry given. Pressed on the button it is the entry the button stands for;
 *   with `chooseEffect="run"` it is also the entry just chosen. Awaited: the
 *   whole split button is busy until it settles.
 * @param {"select"|"run"} [chooseEffect="select"] What choosing an entry does.
 *   "select" hands the button that entry, to be run by a press on it — for
 *   something one does again and again, where the last choice is the likely
 *   next one. "run" does it there and then and leaves the button alone — for a
 *   menu of one-offs around a primary action.
 * @param {string} [menuLabel] What the chevron half is called, for a screen
 *   reader and for the tooltip a long press raises.
 * @param {import("preact").ComponentChildren} [menuIcon] What the chevron half
 *   draws, in place of the chevron. It is the whole of what that half says, so
 *   pass something that still reads as "there is more here" — and say what,
 *   through `menuLabel`.
 * @param {number|string} [menuIconSize] How big that icon is drawn. Defaults to
 *   the button's own font size.
 * @param {"popover"|"dialog"} [mode="popover"] What the menu is drawn as. A
 *   picker left to itself turns into a dialog on a small screen; a split
 *   button's menu stays hung off the button there, so this says popover unless
 *   the caller asks for the dialog back.
 * @param {string} [positionArea="bottom-end"] Where the menu goes — relative to
 *   the whole split button in popover mode, relative to the viewport in dialog
 *   mode. Same grammar as Picker/Popover. The default only applies to a
 *   popover; a dialog keeps Dialog's own "center".
 *
 * Every other prop the Picker's popup answers to is forwarded as-is —
 * `dockedOnSmallTouchScreen`, `dialogExpand*`, `dialogMaxWidth`/`Height`,
 * `marginWithContainer`, `popoverMode`, `popoverSpacing`, `popupLayer`,
 * `popupWidthFitContent`, `popoverMaxHeight`, `backdropVariant`,
 * `pointerInteractionOutsideEffect`, `escapeEffect`, `closeOnFocusOut`,
 * `scrollCapture`, `focusCapture`, `popupBackgroundColor`,
 * `popupBorderRadius`, `animation`. See picker.jsx for what each one says.
 * Anything else lands on the split button's own box.
 */
export const SplitButton = (props) => {
  import.meta.css = css;

  const {
    options = [],
    value,
    defaultValue,
    label,
    action,
    onValueChange,
    chooseEffect = "select",
    menuLabel = naviI18n("button.more_actions"),
    menuIcon = <ChevronDownSvg />,
    menuIconSize,
    loading,
    readOnly,
    disabled,
    // Shared paint: whatever the caller says about how the button looks is said
    // about both halves, or the seam shows.
    cta,
    variant,
    color,
    backgroundColor,
    borderColor,
    borderWidth,
    borderRadius,
    // A split button is a frame the user's eye reads as one box; the left half
    // shrinking under the finger while the right half stays put breaks it.
    pressEffect = "none",
    id,
    ...rest
  } = props;
  // Everything the popup answers to travels to the Picker; everything else is
  // the split button's own box (margins, width, data-*). Sorted by name rather
  // than named one by one so a Picker popup prop is forwarded by adding it to
  // that list, not by threading it through here.
  const [popupProps, boxProps] = splitPopupProps(rest);
  // A split button is a control on the page, not a place one goes: its menu
  // hangs off it even on a phone, where a picker left to itself would decide a
  // small screen means a dialog. Passing mode="dialog" asks for that back.
  const mode = popupProps.mode === undefined ? "popover" : popupProps.mode;
  popupProps.mode = mode;
  // Read against the trigger in popover mode and against the VIEWPORT in
  // dialog mode, so this default only holds for the former — under the chevron
  // half, growing leftwards when the menu is wider than the button. A dialog
  // keeps Dialog's own "center".
  if (popupProps.positionArea === undefined && mode === "popover") {
    popupProps.positionArea = "bottom-end";
  }

  const idDefault = useId();
  const idResolved = id || idDefault;
  const menuId = `${idResolved}_menu`;
  const rootRef = useRef(null);

  const [valueState, setValueState] = useState(
    defaultValue === undefined ? options[0]?.value : defaultValue,
  );
  const valueResolved = value === undefined ? valueState : value;
  const optionShown =
    options.find((option) => option.value === valueResolved) || options[0];

  // Busy is the control's, not the half that happens to be running: an action
  // given as a plain function is watched by running it from here, one given as
  // a navi action carries its own running state and is handed over untouched.
  const actionIsNaviAction = typeof action === "function" && action.isAction;
  const naviActionStatus = useActionStatus(
    actionIsNaviAction ? action : undefined,
  );
  const [actionRunning, setActionRunning] = useState(false);
  const runAction = async (...args) => {
    setActionRunning(true);
    try {
      return await action(...args);
    } finally {
      setActionRunning(false);
    }
  };
  const actionResolved = actionIsNaviAction
    ? action
    : action
      ? runAction
      : undefined;
  const loadingResolved = Boolean(
    loading || actionRunning || naviActionStatus.loading,
  );

  const halfProps = {
    cta,
    variant,
    color,
    backgroundColor,
    borderColor,
    borderWidth,
    borderRadius,
    pressEffect,
    loading: loadingResolved,
    readOnly,
    disabled,
    // The outline belongs around the pair, drawn below.
    loadingOutline: false,
  };

  return (
    <Box
      ref={rootRef}
      className="navi_split_button"
      borderRadius={borderRadius}
      {...boxProps}
    >
      <LoadingOutline
        loading={loadingResolved}
        inset={-1}
        color="var(--button-loader-color)"
      />
      <Group>
        <Button
          id={idResolved}
          value={valueResolved}
          action={actionResolved}
          {...halfProps}
        >
          {label === undefined ? optionShown?.label : label}
        </Button>
        <div className="navi_split_button_menu">
          <Button
            icon
            paddingX="s"
            expandY
            // flex + align: the icon is the whole content, so it is laid out as
            // its own box in the middle of the button. Left to flow inline it
            // would sit on the baseline of a line of text that is not there,
            // with the descender space still kept below it.
            flex
            align="center"
            aria-label={menuLabel}
            command="--navi-open"
            commandFor={menuId}
            {...halfProps}
          >
            <Icon size={menuIconSize} lineOverflow="allow">
              {menuIcon}
            </Icon>
          </Button>
          <Picker
            id={menuId}
            variant="headless"
            allowNameless
            anchor={rootRef}
            {...popupProps}
            readOnly={readOnly}
            disabled={disabled}
            loading={loadingResolved}
            value={chooseEffect === "select" ? valueResolved : undefined}
            action={
              chooseEffect === "select"
                ? (chosenValue, event) => {
                    setValueState(chosenValue);
                    onValueChange?.(chosenValue, event);
                  }
                : undefined
            }
          >
            {chooseEffect === "select" ? (
              <List selectable command="--navi-send">
                {options.map((option, index) => {
                  const {
                    value: optionValue,
                    label: optionLabel,
                    ...optionRest
                  } = option;
                  return (
                    <List.Item
                      selectable
                      key={optionValue}
                      id={`${menuId}_${index}`}
                      index={index}
                      value={optionValue}
                      selected={optionValue === valueResolved}
                      padding="s"
                      spacing="s"
                      {...optionRest}
                    >
                      {optionLabel}
                    </List.Item>
                  );
                })}
              </List>
            ) : (
              <List>
                {options.map((option, index) => {
                  const {
                    value: optionValue,
                    label: optionLabel,
                    ...optionRest
                  } = option;
                  return (
                    <List.Item
                      key={optionValue}
                      id={`${menuId}_${index}`}
                      index={index}
                      padding="0"
                    >
                      <Button
                        variant="bare"
                        expandX
                        alignX="start"
                        padding="s"
                        pressEffect="none"
                        command="--navi-close"
                        commandFor={menuId}
                        value={optionValue}
                        action={actionResolved}
                        {...optionRest}
                      >
                        {optionLabel}
                      </Button>
                    </List.Item>
                  );
                })}
              </List>
            )}
          </Picker>
        </div>
      </Group>
    </Box>
  );
};

// What the Picker's popup answers to — Picker's own popup props, named here so
// a caller reaches all of them through the split button (see picker.jsx's JSDoc
// for what each one says).
const POPUP_PROP_SET = new Set([
  "mode",
  "popupLayer",
  "positionArea",
  "popoverMode",
  "popoverSpacing",
  "popupWidthFitContent",
  "popoverMaxHeight",
  "dialogMaxWidth",
  "dialogMaxHeight",
  "dialogExpand",
  "dialogExpandX",
  "dialogExpandY",
  "dockedOnSmallTouchScreen",
  "marginWithContainer",
  "backdropVariant",
  "pointerInteractionOutsideEffect",
  "escapeEffect",
  "closeOnFocusOut",
  "scrollCapture",
  "focusCapture",
  "popupBackgroundColor",
  "popupBorderRadius",
  "animation",
]);
const splitPopupProps = (props) => {
  const popupProps = {};
  const boxProps = {};
  for (const key of Object.keys(props)) {
    if (POPUP_PROP_SET.has(key)) {
      popupProps[key] = props[key];
    } else {
      boxProps[key] = props[key];
    }
  }
  return [popupProps, boxProps];
};
