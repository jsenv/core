/**
 *
 * Voila le délire:
 *
 * En fait quoiqu'il on mettre un radio/checkbox MAIS
 *
 * il est aussi possible d'afficher une version décorative
 * en instanciant un input dans le <Selectable>
 * il faudra donc ptet un Selectable.Input par example
 * qui se charge de render un input qui est décoratif, le vrai input est caché
 * mais pilote cet input décoratif
 */

import { dispatchCustomEvent, dispatchPublicCustomEvent } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useId, useMemo, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { useFocusGroup } from "@jsenv/navi/src/utils/focus/use_focus_group.js";
import { ControlToInterfaceContext } from "../control_context.js";
import { useControlgroupProps } from "../control_hooks.jsx";
import { Field } from "../field.jsx";
import { Input } from "../input/input.jsx";
import { useCheckableProps } from "../input/use_checkable_props.js";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";
import { List, LIST_ITEM_PSEUDO_CLASSES, ListItem } from "./list.jsx";

const css = /* css */ `
  fieldset.navi_list_container {
    margin: 0; /* Reset margin that might come from fieldset */
    padding: 0; /* Reset padding that might come from fieldset */
  }

  .navi_list_container {
    --list-outline-color: var(--navi-focus-outline-color);
    --x-list-outline-width: calc(
      var(--list-outline-width) + var(--list-border-width)
    );
    --x-list-outline-offset: calc(-1 * var(--list-border-width));
    /* Hover (mouse) */
    --list-item-color-hover: var(--list-item-color);
    --list-item-background-color-hover: light-dark(#f5f5f5, #2a2a2a);
    /* Pointed by mouse — subtle, just a shade above background */
    --list-item-color-mouse-pointed: var(--list-item-color);
    --list-item-background-color-mouse-pointed: light-dark(#ebebeb, #303030);
    /* Pointed by keyboard — subtle light blue highlight */
    --list-item-color-keyboard-pointed: var(--list-item-color);
    --list-item-background-color-keyboard-pointed: light-dark(#c2dcff, #1c3a6e);
    /* Pointed by proxy */
    --list-item-color-pointed: var(--list-item-color);
    --list-item-background-color-pointed: light-dark(#dbeafe, #1c3a6e);
    /* Selected — vivid blue accent */
    --list-item-color-selected: light-dark(#ffffff, #ffffff);
    --list-item-background-color-selected: light-dark(#1a73e8, #2b5fcc);
    /* Disabled */
    --list-item-color-disabled: light-dark(#aaa, #555);
    --list-item-background-color-disabled: var(--list-item-background-color);

    outline-width: var(--x-list-outline-width);
    outline-color: var(--x-list-outline-color);
    outline-offset: var(--x-list-outline-offset);

    &[data-focus] {
      /* outline: var(--list-outline-width) solid var(--navi-focus-outline-color);
      outline-offset: calc(-1 * var(--list-outline-width)); */
    }
    &[data-focus-visible] {
      outline-style: solid;
    }

    &[data-callout] {
      --x-list-border-color: var(--callout-color);
    }

    .navi_list_item:has([data-focus-visible]) {
      --x-list-item-color: var(--list-item-color-keyboard-pointed);
      --x-list-item-background-color: var(
        --list-item-background-color-keyboard-pointed
      );
    }

    /* opt-in: apply background color to selected items */
    &[navi-has-selected-background]:not(:has(input[navi-control-proxy-for])) {
      .navi_list_item[data-selected] {
        --x-list-item-color: var(--list-item-color-selected);
        --x-list-item-background-color: var(
          --list-item-background-color-selected
        );
        &[data-hover] {
          --x-list-item-background-color: var(
            --list-item-background-color-selected,
            var(--list-item-background-color-mouse-pointed)
          ) !important;
        }
      }
      &[data-focus-within] {
        /* Selected must win over keyboard-pointed */
        .navi_list_item[data-selected] {
          --x-list-item-color: var(--list-item-color-selected);
          --x-list-item-background-color: var(
            --list-item-background-color-selected
          );
          &:has([data-focus-visible]) {
            --x-list-item-background-color: var(
              --list-item-background-color-selected,
              var(--list-item-background-color-keyboard-pointed)
            );
          }
        }
      }
    }
  }

  .navi_list_item {
    position: relative;

    &[data-interactive] {
      cursor: pointer;
      user-select: none;
    }
    &[data-hover] {
      --x-list-item-color: var(--list-item-color-mouse-pointed);
      --x-list-item-background-color: var(
        --list-item-background-color-mouse-pointed
      );
    }
    &[data-pointed] {
      --x-list-item-color: var(--list-item-color-pointed);
      --x-list-item-background-color: var(--list-item-background-color-pointed);
    }
    &[data-disabled] {
      --x-list-item-color: var(--list-item-color-disabled);
      --x-list-item-background-color: var(
        --list-item-background-color-disabled
      );
      cursor: default;
      pointer-events: none;
    }
    &[data-readonly] {
      --x-list-item-color: var(--list-item-color-disabled);
      cursor: default;
    }
  }
`;

const SelectableListMultipleContext = createContext(false);
// Stable reference for an empty selection so the action always receives an
// array (never undefined) and callers don't get a new reference each render.
const EMPTY_SELECTION = [];

// Interactive variant: manages hover/keyboard/selection state and handles the
// navi event protocol. When an action is provided it binds the action to ui state
// and fires it on select. When only uiAction is provided it calls it directly.
export const SelectableList = (props) => {
  import.meta.css = css;
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  // we allow ourselves to auto-generate a name
  const defaultName = useId();
  props.name = props.name || `listbox_${defaultName}`;
  const {
    ref,
    multiple,
    selectedIndicator = "backgroundColor",
    focusGroupDirection,
    focusGroupWrap,
  } = props;
  const [listControlProps, remainingProps] = useControlgroupProps(props, {
    controlType: multiple ? "checkbox_group" : "radio_group",
    childComponentType: multiple ? "checkbox" : "radio",
    aggregateChildStates: multiple
      ? (childUIStateControllers) => {
          const values = [];
          for (const childUIStateController of childUIStateControllers) {
            if (childUIStateController.uiState) {
              values.push(childUIStateController.uiState);
            }
          }
          // Return a stable empty-array reference when nothing is selected so
          // the action always receives an array (never undefined) and signal
          // comparisons don't see a new reference on every render.
          return values.length === 0 ? EMPTY_SELECTION : values;
        }
      : (childUIStateControllers) => {
          let activeValue;
          for (const childUIStateController of childUIStateControllers) {
            if (childUIStateController.uiState) {
              activeValue = childUIStateController.uiState;
              break;
            }
          }
          return activeValue;
        },
  });
  useFocusGroup(ref, {
    direction: focusGroupDirection,
    wrap: focusGroupWrap,
    // Up/Down navigate between list items only (the visually-hidden real inputs).
    ySelector: "[navi-selectable-real-input]",
  });

  const listVnode = (
    <List
      as="fieldset"
      navi-has-selected-background={
        selectedIndicator === "backgroundColor" ? "" : undefined
      }
      {...listControlProps}
      {...remainingProps}
      name={undefined}
      selectedIndicator={undefined}
      multiple={undefined}
      onnavi_list_nav={(e) => {
        const { item, event } = e.detail;
        // const id = item ? item.id : null;
        // const isNonUserNav =
        //   event.type === "navi_list_nav_top_on_displayed" ||
        //   event.type === "navi_list_top_match_change";
        const isAutomaticNav =
          event.type === "navi_list_nav_top_on_displayed" ||
          event.type === "navi_list_top_match_change" ||
          event.type === "navi_scroll_restore";
        if (item && !isAutomaticNav) {
          const listEl = e.currentTarget;
          dispatchPublicCustomEvent(listEl, "navi_list_item_point", {
            item,
            event,
          });
        }
      }}
      onnavi_list_request_nav={(e) => {
        const { item } = e.detail;
        if (!item) {
          return;
        }
        const listEl = e.currentTarget;
        dispatchCustomEvent(listEl, "navi_list_request_scroll", {
          event: e,
          item,
        });
      }}
      onnavi_selectable_list_request_item_unselect={(e) => {
        const { value } = e.detail;
        const listEl = e.currentTarget;
        const valueStr = String(value);
        const realInput = listEl.querySelector(
          `[navi-selectable-real-input][value="${valueStr.replaceAll('"', '\\"')}"]`,
        );
        if (realInput && realInput.checked) {
          realInput.click();
        }
      }}
      onnavi_list_request_select={(e) => {
        const { item } = e.detail;
        if (!item) {
          return;
        }
        const listEl = e.currentTarget;
        dispatchCustomEvent(listEl, "navi_list_request_nav", {
          event: e,
          item,
        });
        dispatchPublicCustomEvent(listEl, "navi_list_select", {
          item,
          event: e,
        });
        const requester = item
          ? listEl.querySelector(`#${CSS.escape(item.id)}`)
          : e.target;
        dispatchRequestAction(listEl, {
          event: e,
          requester,
        });
      }}
    />
  );

  return (
    <SelectableListMultipleContext.Provider value={multiple}>
      {listVnode}
    </SelectableListMultipleContext.Provider>
  );
};

export const requestSelectableListItemUnselect = (listEl, { value, event }) => {
  return dispatchCustomEvent(
    listEl,
    "navi_selectable_list_request_item_unselect",
    { value, event },
  );
};

const SelectableRealInputContext = createContext(null);

export const Selectable = (props) => {
  const {
    index,
    id,
    highlight,
    hidden,
    filtered,
    defaultSelected,
    selected,
    pointed,
    selectableArea,
    ...rest
  } = props;
  const multiple = useContext(SelectableListMultipleContext);
  const inputRef = useRef();
  const inputType = multiple ? "checkbox" : "radio";
  const inputId = `${id}_input`;
  const [checkableProps, remainingProps] = useCheckableProps(
    {
      readOnlyMessage: naviI18n(`list_item.readonly`, props),
      ...rest,
      ref: inputRef,
      id: inputId,
      type: inputType,
      defaultChecked: defaultSelected,
      checked: selected,
      action: (v, { event }) => {
        const listContainerEl = event.currentTarget.closest(
          ".navi_list_container",
        );
        dispatchRequestAction(listContainerEl, { event });
      },
    },
    {
      multiple,
    },
  );
  const { checked, value, basePseudoState, children } = checkableProps;
  const readOnly = basePseudoState[":read-only"];
  const disabled = basePseudoState[":disabled"];
  const loading = basePseudoState[":-navi-loading"];
  const realInputContextValue = useMemo(() => {
    return {
      id: inputId,
      type: inputType,
      checked,
      readOnly,
      value,
    };
  }, [inputId, inputType, checked, readOnly, value]);

  return (
    <ListItem
      id={id}
      index={index}
      highlight={highlight}
      filtered={filtered}
      hidden={hidden}
      pseudoClasses={SELECTABLE_PSEUDO_CLASSES}
      basePseudoState={{
        ":-navi-selected": checked,
        ":-navi-pointed": pointed,
        ...basePseudoState,
      }}
      aria-selected={checked}
    >
      <Field
        as={selectableArea === "manual" ? "div" : undefined}
        padding="m"
        flex
        alignY="center"
        spacing="s"
        expandX
        {...remainingProps}
        selectableArea={undefined}
        basePseudoState={basePseudoState}
        pseudoStateSelector="[navi-selectable-real-input]"
        disabled={disabled}
        readOnly={readOnly}
        loading={loading}
        interactive
      >
        <SelectableRealInput
          {...checkableProps}
          // eslint-disable-next-line react/no-children-prop
          children={undefined}
        />
        <SelectableRealInputContext.Provider value={realInputContextValue}>
          {children}
        </SelectableRealInputContext.Provider>
      </Field>
    </ListItem>
  );
};
const SELECTABLE_PSEUDO_CLASSES = [
  ...LIST_ITEM_PSEUDO_CLASSES,
  ":hover",
  ":disabled",
  ":read-only",
  ":focus-within",
  ":focus",
  ":focus-visible",
  ":-navi-loading",
  ":-navi-pointed",
  ":-navi-selected",
  ":disabled",
  ":read-only",
];
const SelectableRealInput = (props) => {
  return (
    <Box
      as="input"
      {...props}
      navi-selectable-real-input=""
      navi-visually-hidden=""
      data-callout-arrow-x="center"
    />
  );
};
const SelectableInputProxy = (props) => {
  const selectableRealInputProps = useContext(SelectableRealInputContext);
  if (!selectableRealInputProps) {
    throw new Error(
      "Selectable.Input must be used within a Selectable component",
    );
  }

  // Reset FieldToInterfaceContext to ensure we don't read id or report our
  // states (real input should take id and report)
  return (
    <ControlToInterfaceContext.Provider value={undefined}>
      <Input
        {...props}
        {...selectableRealInputProps}
        id={undefined}
        navi-control-proxy-for={selectableRealInputProps.id}
        // give it a specific name to avoid radio name (would unselect others)
        // (making it unique to the list would be enough, but here it's even more unique)
        name={`${selectableRealInputProps.id}_proxy`}
        aria-hidden="true"
        tabIndex={-1}
      />
    </ControlToInterfaceContext.Provider>
  );
};
Selectable.Input = SelectableInputProxy;
