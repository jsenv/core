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
import {
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { useFocusGroup } from "@jsenv/navi/src/utils/focus/use_focus_group.js";
import { ControlToInterfaceContext } from "../control_context.js";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "../control_hooks.jsx";
import { Field } from "../field.jsx";
import { Input } from "../input/input.jsx";
import { useCheckableProps } from "../input/use_checkable_props.js";
import {
  dispatchRequestAction,
  dispatchRequestInteraction,
} from "../validation/custom_constraint_validation.js";
import { List, LIST_ITEM_PSEUDO_CLASSES, ListItem } from "./list.jsx";

const css = /* css */ `
  @layer navi {
    .navi_list_container {
      --list-outline-color: var(--navi-focus-outline-color);
      --list-item-outline-color: var(--navi-focus-outline-color);
      --list-item-outline-width: 2px;
      --list-item-outline-offset: calc(-1 * var(--list-item-outline-width));
      /* Hover (mouse) */
      --list-item-color-hover: var(--list-item-color);
      --list-item-background-color-hover: light-dark(#f5f5f5, #2a2a2a);
      /* Pointed by mouse — subtle, just a shade above background */
      --list-item-color-mouse-pointed: var(--list-item-color);
      --list-item-background-color-mouse-pointed: light-dark(#ebebeb, #303030);
      /* Pointed by keyboard — subtle light blue highlight */
      --list-item-color-keyboard-pointed: var(--list-item-color);
      --list-item-background-color-keyboard-pointed: light-dark(
        #c2dcff,
        #1c3a6e
      );
      /* Pointed by proxy */
      --list-item-color-pointed: var(--list-item-color);
      --list-item-background-color-pointed: light-dark(#dbeafe, #1c3a6e);
      /* Selected — vivid blue accent */
      --list-item-color-selected: white;
      --list-item-background-color-selected: rgb(3, 30, 60);
      /* Disabled */
      --list-item-color-disabled: light-dark(#aaa, #555);
      --list-item-background-color-disabled: var(--list-item-background-color);
    }
  }

  fieldset.navi_list_container {
    margin: 0; /* Reset margin that might come from fieldset */
    padding: 0; /* Reset padding that might come from fieldset */
  }

  .navi_list_container {
    --x-list-outline-width: calc(
      var(--list-outline-width) + var(--list-border-width)
    );
    --x-list-outline-offset: calc(-1 * var(--list-border-width));

    outline-width: var(--x-list-outline-width);
    outline-color: var(--list-outline-color);
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
  }

  .navi_list_item {
    position: relative;
    outline-width: var(--list-item-outline-width);
    outline-color: var(--list-item-outline-color);
    outline-offset: var(--list-item-outline-offset);

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
    /* No input proxy: focused,selected */
    &:not(:has(input[navi-control-proxy-for])) {
      &:has([data-focus-visible]) {
        --x-list-item-color: var(--list-item-color-keyboard-pointed);
        --x-list-item-background-color: var(
          --list-item-background-color-keyboard-pointed
        );
        outline-style: solid;

        /* Selected must win over keyboard-pointed */
        &[data-selected] {
          --x-list-item-background-color: var(
            --list-item-background-color-selected,
            var(--list-item-background-color-keyboard-pointed)
          );
        }
      }

      &[data-selected] {
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
  const [
    listControlProps,
    remainingProps,
    childrenWrapperProps,
    uiGroupStateController,
  ] = useControlgroupProps(props, {
    stateType: multiple ? "array" : "",
    controlType: multiple ? "checkbox_group" : "radio_group",
    childControlFilter: multiple
      ? (childUIStateController) => {
          return (
            childUIStateController.controlType === "input" &&
            childUIStateController.props.type === "checkbox"
          );
        }
      : (childUIStateController) => {
          return (
            childUIStateController.controlType === "input" &&
            childUIStateController.props.type === "radio"
          );
        },
    aggregateChildStates: multiple
      ? (childUIStateControllers) => {
          const values = [];
          for (const childUIStateController of childUIStateControllers) {
            if (childUIStateController.uiState) {
              values.push(childUIStateController.uiState);
            }
          }
          return values.length === 0 ? undefined : values;
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

  // "Current item" tracking — the item that an external controller (e.g. an
  // <input navi-list>) navigates from. Defaults to the first selected item,
  // else the first navigable item. Updated when:
  //   - an item's real input gains focus (via Tab, click, etc.)
  //   - the controller dispatches navi_request_list_nav
  // The current id is announced via navi_list_current_change (bubbling) so a
  // connected input can update its aria-controls / aria-activedescendant.
  const currentIdRef = useRef(null);
  const setCurrentId = (id, event) => {
    const previousId = currentIdRef.current;
    if (previousId === id) {
      return;
    }
    currentIdRef.current = id;
    const listEl = ref.current;
    if (!listEl) {
      return;
    }
    if (id) {
      listEl.setAttribute("navi-current-id", id);
    } else {
      listEl.removeAttribute("navi-current-id");
    }
    dispatchPublicCustomEvent(listEl, "navi_current_change", {
      event,
      id,
      realInputId: id ? `${id}_input` : null,
    });
  };
  const getNavigableElements = () => {
    const listEl = ref.current;
    if (!listEl) {
      return [];
    }
    const itemEls = Array.from(
      listEl.querySelectorAll("[navi-list-item-real]"),
    );
    const navigableEls = [];
    for (const itemEl of itemEls) {
      if (itemEl.hidden) {
        continue;
      }
      const realInput = itemEl.querySelector("[navi-selectable-real-input]");
      if (!realInput || realInput.disabled) {
        continue;
      }
      navigableEls.push(itemEl);
    }
    return navigableEls;
  };
  // On mount: set the initial current item to the first selected, else the first navigable.
  // After that, focusin events on the list keep currentIdRef up to date.
  useLayoutEffect(() => {
    const navigableEls = getNavigableElements();
    if (navigableEls.length === 0) {
      return;
    }
    let initialEl;
    for (const el of navigableEls) {
      const realInput = el.querySelector("[navi-selectable-real-input]");
      if (realInput && realInput.checked) {
        initialEl = el;
        break;
      }
    }
    if (!initialEl) {
      initialEl = navigableEls[0];
    }
    setCurrentId(initialEl.id);
  }, []);

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
      // Track focus inside the list: whichever item gets focus becomes current.
      onFocusIn={(e) => {
        const realInput = e.target.closest("[navi-selectable-real-input]");
        if (!realInput) {
          return;
        }
        const itemEl = realInput.closest("[navi-list-item-real]");
        if (itemEl && itemEl.id) {
          setCurrentId(itemEl.id, e);
        }
      }}
      onnavi_request_select={(e) => {
        const { id } = e.detail;
        if (id === undefined) {
          return;
        }
        const inputId = `${id}_input`;
        const childController = uiGroupStateController.findChildById(inputId);
        if (!childController) {
          return;
        }
        const list = ref.current;
        const allowed = dispatchRequestInteraction(list, e, "select");
        if (!allowed) {
          e.preventDefault();
          return;
        }
        if (childController.setUIState(true, e)) {
          dispatchRequestAction(list, { event: e });
        }
      }}
      onnavi_request_unselect={(e) => {
        const { id } = e.detail;
        if (id === undefined) {
          return;
        }
        const inputId = `${id}_input`;
        const childController = uiGroupStateController.findChildById(inputId);
        if (!childController) {
          return;
        }
        const list = ref.current;
        const allowed = dispatchRequestInteraction(list, e, "unselect");
        if (!allowed) {
          e.preventDefault();
          return;
        }
        if (childController.setUIState(false, e)) {
          dispatchRequestAction(list, { event: e });
        }
      }}
      onnavi_request_nav={(e) => {
        const { goal } = e.detail;
        const navigableEls = getNavigableElements();
        if (navigableEls.length === 0) {
          return;
        }
        const currentId = currentIdRef.current;
        let currentIndex = -1;
        if (currentId) {
          currentIndex = navigableEls.findIndex((el) => el.id === currentId);
        }
        let targetEl;
        if (goal === "first") {
          targetEl = navigableEls[0];
        } else if (goal === "last") {
          targetEl = navigableEls[navigableEls.length - 1];
        } else if (goal === "down") {
          if (currentIndex === -1) {
            targetEl = navigableEls[0];
          } else if (currentIndex < navigableEls.length - 1) {
            targetEl = navigableEls[currentIndex + 1];
          } else {
            targetEl = navigableEls[navigableEls.length - 1];
          }
        } else if (goal === "up") {
          if (currentIndex === -1) {
            targetEl = navigableEls[0];
          } else if (currentIndex > 0) {
            targetEl = navigableEls[currentIndex - 1];
          } else {
            targetEl = navigableEls[0];
          }
        }
        if (!targetEl) {
          return;
        }
        setCurrentId(targetEl.id, e);
        dispatchCustomEvent(ref.current, "navi_request_scroll", {
          event: e,
          id: targetEl.id,
        });
      }}
      onnavi_request_activate={(e) => {
        const currentId = currentIdRef.current;
        if (!currentId) {
          return;
        }
        if (multiple) {
          const inputId = `${currentId}_input`;
          const childController = uiGroupStateController.findChildById(inputId);
          const isSelected = childController && childController.uiState;
          dispatchCustomEvent(
            ref.current,
            isSelected ? "navi_request_unselect" : "navi_request_select",
            { event: e, id: currentId },
          );
          return;
        }
        dispatchCustomEvent(ref.current, "navi_request_select", {
          event: e,
          id: currentId,
        });
      }}
    >
      <ControlgroupChildrenWrapper {...childrenWrapperProps}>
        {props.children}
      </ControlgroupChildrenWrapper>
    </List>
  );

  return (
    <SelectableListMultipleContext.Provider value={multiple}>
      {listVnode}
    </SelectableListMultipleContext.Provider>
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
    matchScore,
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
  inputRef.nullExpected = true; // virtualization
  const [checkableProps, remainingProps, ChildrenContextWrapper] =
    useCheckableProps({
      readOnlyMessage: naviI18n(`constraints.readonly.option`, props),
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
    });
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
      matchScore={matchScore}
      pseudoClasses={SELECTABLE_PSEUDO_CLASSES}
      basePseudoState={{
        ":-navi-selected": checked,
        ":-navi-pointed": pointed,
        ...basePseudoState,
      }}
      aria-selected={checked}
      selected={checked}
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
          <ChildrenContextWrapper>{children}</ChildrenContextWrapper>
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
      // navi-debug
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
