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
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { useFocusGroup } from "@jsenv/navi/src/utils/focus/use_focus_group.js";
import { ControlIdContext } from "../control_context.js";
import {
  ControlChildrenWrapper,
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "../control_hooks.jsx";
import { getUIStateControllerById } from "../controller_registry.js";
import { Input } from "../input/input.jsx";
import { useCheckableProps } from "../input/use_checkable_props.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";

const css = /* css */ `
  @layer navi {
    .navi_list_container[navi-selectable] {
      /* Focus outline */
      --list-item-outline-width: var(--navi-focus-outline-width);
      /* here we draw the outline ON the item, not outside of it */
      /* This ensure the outline is visible even when there is scrollbars (which happens a lot on list items) */
      --list-item-outline-offset: calc(-1 * var(--list-item-outline-width));
      --list-item-outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --list-item-border-color: var(--navi-control-border-color);
      --list-item-padding-x-default: var(--navi-control-padding-x-default);
      --list-item-padding-y-default: var(--navi-control-padding-y-default);

      /* Hover (mouse) */
      --list-item-background-color-hover: light-dark(#f5f5f5, #2a2a2a);
      --list-item-color-hover: var(--list-item-color);
      /* Pointed by mouse — subtle, just a shade above background */
      --list-item-background-color-mouse-pointed: light-dark(#ebebeb, #303030);
      --list-item-color-mouse-pointed: var(--list-item-color);
      /* Pointed by keyboard — subtle light blue highlight */
      --list-item-color-keyboard-pointed: var(--list-item-color);
      --list-item-background-color-keyboard-pointed: light-dark(
        #c2dcff,
        #1c3a6e
      );
      /* Pointed by proxy */
      --list-item-background-color-pointed: light-dark(#dbeafe, #1c3a6e);
      --list-item-color-pointed: var(--list-item-color);
      /* Selected — vivid blue accent */
      --list-item-color-selected: white;
      --list-item-background-color-selected: var(--navi-accent-color);
      --list-item-border-color-selected: var(
        --list-item-background-color-selected
      );
      /* Disabled */
      --list-item-color-disabled: light-dark(#aaa, #555);
      --list-item-background-color-disabled: var(--list-item-background-color);
    }
  }

  fieldset.navi_list_container[navi-selectable] {
    margin: 0; /* Reset margin that might come from fieldset */
    padding: 0; /* Reset padding that might come from fieldset */
  }
  .navi_list_container[navi-selectable] {
    &[data-callout] {
      --x-list-border-color: var(--callout-color);
    }

    .navi_list_item {
      --x-list-item-cursor: default;
      --x-list-item-border-color: var(--list-item-border-color);

      position: relative;
      font-size: var(--navi-control-font-size);
      font-family: var(--navi-control-font-family);
      -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);
    }
  }

  .navi_list_item[navi-selectable] {
    outline-width: var(--list-item-outline-width);
    outline-color: var(--list-item-outline-color);
    outline-offset: var(--list-item-outline-offset);
    cursor: var(--x-list-item-cursor);
    --list-item-padding-x-default: inherit;
    --list-item-padding-y-default: inherit;

    &[navi-selectable] {
      user-select: none;
    }
    &[navi-selectable-area-all] {
      --x-list-item-cursor: pointer;
      pointer-events: none;

      [navi-selectable-real-input] {
        z-index: 0;
        outline: none;
        opacity: 0;
        clip-path: none;
        cursor: var(--x-list-item-cursor);
        pointer-events: auto;
      }
    }

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
      &:has([navi-selectable-real-input][data-focus-visible]) {
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
          --x-list-item-color: var(
            --list-item-color-selected,
            var(--list-item-color-keyboard-pointed)
          );
        }
      }

      &[data-selected] {
        --x-list-item-border-color: var(--list-item-border-color-selected);
        --x-list-item-background-color: var(
          --list-item-background-color-selected
        );
        --x-list-item-color: var(--list-item-color-selected);

        &[data-hover] {
          --x-list-item-background-color: var(
            --list-item-background-color-selected,
            var(--list-item-background-color-mouse-pointed)
          ) !important;
        }

        input,
        .navi_picker_content {
          color: revert;
        }
      }
    }

    &[data-disabled] {
      --x-list-item-color: var(--list-item-color-disabled);
      --x-list-item-background-color: var(
        --list-item-background-color-disabled
      );
      --x-list-item-cursor: default;
      pointer-events: none;
    }
    &[data-readonly] {
      --x-list-item-color: var(--list-item-color-disabled);
      --x-list-item-cursor: default;
    }
  }
`;

const SelectableListMultipleContext = createContext(false);
// Interactive variant: manages hover/keyboard/selection state and handles the
// navi event protocol. When an action is provided it binds the action to ui state
// and fires it on select. When only uiAction is provided it calls it directly.
export const ListSelectableResolver = (props) => {
  const Next = useNextResolver();

  if (props.selectable) {
    return <ListSelectable {...props} />;
  }
  return <Next {...props} />;
};
const ListSelectable = (props) => {
  const Next = useNextResolver();
  import.meta.css = css;
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
  const [listControlRootProps, listControlProps, childrenWrapperProps] =
    useControlgroupProps(props, {
      stateType: multiple ? "array" : "",
      controlType: multiple ? "checkbox_group" : "radio_group",
      childControlFilter: multiple
        ? (childUIStateController) => {
            return (
              childUIStateController.controlType === "input" &&
              childUIStateController.controlHostProps.type === "checkbox"
            );
          }
        : (childUIStateController) => {
            return (
              childUIStateController.controlType === "input" &&
              childUIStateController.controlHostProps.type === "radio"
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
  const uiGroupStateController = getUIStateControllerById(listControlProps.id);
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
    <Next
      as="fieldset"
      navi-selectable=""
      navi-has-selected-background={
        selectedIndicator === "backgroundColor" ? "" : undefined
      }
      {...listControlRootProps}
      {...listControlProps}
      name={undefined}
      selectedIndicator={undefined}
      selectable={undefined}
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
        dispatchRequestInteraction(list, {
          event: e,
          name: "select",
          prevented: () => e.preventDefault(), // tell the requester that we don't want to select this item
          allowed: () => childController.setUIState(childController.value, e),
        });
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
        dispatchRequestInteraction(list, {
          event: e,
          name: "unselect",
          prevented: () => e.preventDefault(), // tell the requester that we don't want to unselect this item
          allowed: () => childController.setUIState(undefined, e),
        });
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
    </Next>
  );
  return (
    <SelectableListMultipleContext.Provider value={multiple}>
      {listVnode}
    </SelectableListMultipleContext.Provider>
  );
};

const SelectableRealInputContext = createContext(null);

export const ListItemSelectableResolver = (props) => {
  const Next = useNextResolver();
  if (props.selectable) {
    return <ListItemSelectable {...props} />;
  }
  return <Next {...props} />;
};
const ListItemSelectable = (props) => {
  const Next = useNextResolver();
  const defaultId = useId();
  const {
    index,
    id = defaultId,
    highlight,
    hidden,
    filtered,
    matchScore,
    defaultSelected,
    selected,
    pointed,
    selectableArea = "all",
    ...rest
  } = props;
  const multiple = useContext(SelectableListMultipleContext);
  const inputRef = useRef();
  const inputType = multiple ? "checkbox" : "radio";
  const inputId = `${id}_input`;
  inputRef.nullCanHappen = true; // virtualization
  const [checkableRootProps, checkableProps, controlChildrenWrapperProps] =
    useCheckableProps({
      readOnlyMessage: naviI18n(`constraint.readonly.option`, props),
      ...rest,
      ref: inputRef,
      id: inputId,
      type: inputType,
      defaultChecked: defaultSelected,
      checked: selected,
    });
  const { checked, value, basePseudoState, children } = checkableProps;
  const readOnly = basePseudoState[":read-only"];
  // const disabled = basePseudoState[":disabled"];
  // const loading = basePseudoState[":-navi-loading"];
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
    <Next
      id={id}
      index={index}
      highlight={highlight}
      filtered={filtered}
      hidden={hidden}
      matchScore={matchScore}
      aria-selected={checked}
      selected={checked}
      navi-selectable=""
      spacing="s"
      flex
      alignY="center"
      {...checkableRootProps}
      pseudoClasses={SELECTABLE_PSEUDO_CLASSES}
      basePseudoState={{
        ":-navi-selected": checked,
        ":-navi-pointed": pointed,
        ...basePseudoState,
      }}
      ref={props.ref}
      selectable={undefined}
      navi-selectable-area-all={selectableArea === "all" ? "" : undefined}
    >
      <SelectableRealInput
        {...checkableProps}
        // eslint-disable-next-line react/no-children-prop
        children={undefined}
      />
      <SelectableRealInputContext.Provider value={realInputContextValue}>
        <ControlChildrenWrapper {...controlChildrenWrapperProps}>
          {children}
        </ControlChildrenWrapper>
      </SelectableRealInputContext.Provider>
    </Next>
  );
};

const SELECTABLE_PSEUDO_CLASSES = [
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
  // here for some reason we can't use <Input, so instead we use <Box
  // ideally we could use <Input but it would interfere with the control props we already create
  // in the ListItemSelectable
  return (
    <Box
      as="input"
      pseudoClasses={SELECTABLE_INPUT_PSEUDO_CLASSES}
      {...props}
      navi-visually-hidden=""
      navi-selectable-real-input=""
      data-callout-arrow-x="center"
      // navi-debug
    />
  );
};
const SELECTABLE_INPUT_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":checked",
];

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
    <ControlIdContext.Provider value={undefined}>
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
    </ControlIdContext.Provider>
  );
};
export const SelectableInput = SelectableInputProxy;
