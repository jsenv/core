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
import {
  ControlIdContext,
  LoadingContext,
  ReadOnlyContext,
} from "../control_context.js";
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
      --list-item-padding-x-default: var(--navi-list-item-padding-x-default);
      --list-item-padding-y-default: var(--navi-list-item-padding-y-default);

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
      /* A selectable item is a control: it stands in a row with pickers and
         inputs (a horizontal list of choices), so it takes the control line
         with the control font — the same number of pixels tall as them. */
      line-height: var(--navi-control-line-height);
      -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);
    }
  }

  .navi_list_container[navi-selectable] {
    .navi_list_fallback,
    .navi_list_search_fallback {
      --list-item-padding-x-default: inherit;
      --list-item-padding-y-default: inherit;
    }
  }

  .navi_list_item[navi-selectable] {
    --list-item-padding-x-default: inherit;
    --list-item-padding-y-default: inherit;

    outline-width: var(--list-item-outline-width);
    outline-color: var(--list-item-outline-color);
    outline-offset: var(--list-item-outline-offset);
    cursor: var(--x-list-item-cursor);

    .navi_checkbox {
      --margin: 0;
    }
    .navi_radio {
      --margin: 0;
    }

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

      /* A popup opened from the row is not part of the row: it is shown over
         the page — in the browser's own top layer for a modal one — and only
         happens to be declared here. pointer-events is inherited, so without
         this it inherits the row's own "none" and nothing inside it can be
         clicked, however far from the row it is painted. Matched on what makes
         an element a popup to the browser rather than on navi's own attribute:
         anything shown over the page has the same claim, navi's or not. */
      dialog,
      [popover] {
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
        /* When outline displayed + border radius behind the outline we can see some pixels of borders + background */
        /* To avoid this we need to hide borders and background */
        /* border transparent + background clip padding box work */
        /* We set background clip only here otherwise we would have the pixel issue all the time between borders and background  */
        --x-list-item-border-color: transparent;
        background-clip: padding-box;

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
// A single-select list whose selected row, pressed again, lets go: what its
// rows' radios need to know to answer the press (see `deselectable` on Input).
const SelectableListDeselectableContext = createContext(false);
// A row of a selectable list is selectable — the list is what decides, and a
// row says nothing unless it wants out (`selectable={false}` on a row that is
// only there to be read). Also set to false by a non-selectable list, so a list
// nested inside a selectable row does not inherit the outer list's answer.
const ListSelectableContext = createContext(false);
// Interactive variant: manages hover/keyboard/selection state and handles the
// navi event protocol. When an action is provided it binds the action to ui state
// and fires it on select. When only uiAction is provided it calls it directly.
export const ListSelectableResolver = (props) => {
  const Next = useNextResolver();

  if (props.selectable) {
    return <ListSelectable {...props} />;
  }
  return (
    <ListSelectableContext.Provider value={false}>
      <Next {...props} />
    </ListSelectableContext.Provider>
  );
};
const ListSelectable = (props) => {
  const Next = useNextResolver();
  import.meta.css = css;
  // we allow ourselves to auto-generate a name
  const defaultName = useId();
  props.name = props.name || `listbox_${defaultName}`;
  const { ref, multiple, deselectable, focusGroupDirection, focusGroupWrap } =
    props;
  // What the list holds, which is not the same as what its rows say. A list
  // draws the rows it needs and no more: the selected one may be scrolled out
  // of the window, or filtered out of the view. Aggregating over the rows that
  // happen to be mounted would then lose the selection — a row that is not
  // there cannot say it is not selected.
  const selectionRef = useRef(undefined);
  if (selectionRef.current === undefined) {
    selectionRef.current = Object.hasOwn(props, "value")
      ? props.value
      : props.defaultValue;
  }
  const aggregateChildStates = (children) => {
    const kept = selectionRef.current;
    if (multiple) {
      const drawnValues = new Set(children.map((child) => child.props.value));
      const stillSelected = Array.isArray(kept)
        ? kept.filter((value) => !drawnValues.has(value))
        : [];
      for (const child of children) {
        if (child.uiState !== undefined) {
          stillSelected.push(child.uiState);
        }
      }
      const values = stillSelected.length === 0 ? undefined : stillSelected;
      selectionRef.current = values;
      return values;
    }
    for (const child of children) {
      if (child.uiState !== undefined) {
        selectionRef.current = child.uiState;
        return child.uiState;
      }
    }
    // No drawn row claims it. If the row that held it IS drawn, it was really
    // deselected; if it is not, the list keeps what it holds.
    const keptIsDrawn = children.some((child) => child.props.value === kept);
    if (keptIsDrawn) {
      selectionRef.current = undefined;
      return undefined;
    }
    return kept;
  };
  const [listControlRootProps, listControlProps, childrenWrapperProps] =
    useControlgroupProps(props, {
      stateType: multiple ? "array" : "",
      controlType: multiple ? "checkbox_group" : "radio_group",
      aggregateChildStates,
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
  //   - the controller dispatches navi_request_nav
  // The current id is announced via navi_current_change (bubbling) so a
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
      navi-selectable=""
      {...listControlRootProps}
      {...listControlProps}
      // "loading" is a control prop, so useControlgroupProps consumes it (into
      // aria-busy / the :-navi-loading pseudo state) and it does not survive
      // into the props below. ListUI needs it too — it is what makes the list
      // render skeleton rows instead of its (not yet known) items.
      loading={props.loading}
      name={undefined}
      value={undefined}
      defaultValue={undefined}
      selectable={undefined}
      multiple={undefined}
      deselectable={undefined}
      focusGroupDirection={undefined}
      focusGroupWrap={undefined}
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
          // Asked of the item too, not only of the list: an item can be the one
          // refusing (the list already holds all it accepts, see maxLength), and
          // it is the one that then says why.
          allowed: () => {
            dispatchRequestInteraction(childController.ref.current, {
              event: e,
              name: "select",
              prevented: () => e.preventDefault(),
              allowed: () =>
                childController.setUIState(childController.value, e),
            });
          },
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
      // "previous"/"next", not "up"/"down": a list is a line of items whichever
      // way it is laid out, and a horizontal one walks sideways. The keys that
      // drive it (arrows, Home/End) map onto that here, and so do the commands
      // (--navi-previous / --navi-next / --navi-first / --navi-last).
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
        } else if (goal === "next") {
          if (currentIndex === -1) {
            targetEl = navigableEls[0];
          } else if (currentIndex < navigableEls.length - 1) {
            targetEl = navigableEls[currentIndex + 1];
          } else {
            targetEl = navigableEls[navigableEls.length - 1];
          }
        } else if (goal === "previous") {
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
        if (multiple || deselectable) {
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
    <ListSelectableContext.Provider value={true}>
      <SelectableListMultipleContext.Provider value={multiple}>
        <SelectableListDeselectableContext.Provider
          value={Boolean(deselectable)}
        >
          {listVnode}
        </SelectableListDeselectableContext.Provider>
      </SelectableListMultipleContext.Provider>
    </ListSelectableContext.Provider>
  );
};

const SelectableRealInputContext = createContext(null);

export const ListItemSelectableResolver = (props) => {
  const Next = useNextResolver();
  const listSelectable = useContext(ListSelectableContext);
  // A header/footer row is a title, not a choice — it stays out even in a
  // selectable list. (A skeleton row never reaches here: its own resolver runs
  // before this one.)
  const isHeaderOrFooter = Boolean(props.header || props.footer);
  const selectable =
    props.selectable ??
    (isHeaderOrFooter || props.role === "presentation"
      ? false
      : listSelectable);
  if (selectable) {
    return <ListItemSelectable {...props} selectable />;
  }
  return <Next {...props} />;
};
const ListItemSelectable = (props) => {
  const Next = useNextResolver();
  const defaultId = useId();
  // Whether the caller SAYS anything about this row's selection. Passing
  // `checked: undefined` is not the same as not passing it: a control with the
  // key present calls itself controlled, and a controlled row is one the list
  // must not seed — which is exactly how a list-level `value` ended up never
  // reaching its rows.
  const hasSelectedProp = Object.hasOwn(props, "selected");
  const {
    index,
    id = defaultId,
    matchInfo,
    hidden,
    filtered,
    defaultSelected,
    selected,
    pointed,
    selectableArea = "all",
    // The row's own click handler, kept out of the control props below: those
    // describe the hidden input that carries the selection, and a caller
    // writing onClick on a <List.Item> is talking about the row they see.
    onClick,
    ...rest
  } = props;
  const multiple = useContext(SelectableListMultipleContext);
  // A checkbox toggles on its own; only a radio has to be told it may let go.
  const deselectable =
    useContext(SelectableListDeselectableContext) && !multiple;
  // Whose reason it is that this row cannot be taken. Read-only reaching it
  // from above is the LIST's, and what is settled is then the whole answer —
  // said as the selection where several things are taken, as the choice where
  // one thing is. Said of each row in turn, "this option is not available"
  // describes something else entirely: a list where each row happens to be
  // unavailable for its own reasons, which goes on being said that way. Busy
  // is not settled either: a list waiting on something says nothing about what
  // will be possible once it is done, so the row keeps its own words.
  const readOnlyFromAbove = useContext(ReadOnlyContext);
  const loadingFromAbove = useContext(LoadingContext);
  const answerIsSettled = Boolean(readOnlyFromAbove) && !loadingFromAbove;
  const readOnlyMessageKey = answerIsSettled
    ? multiple
      ? `constraint.readonly.selection`
      : `constraint.readonly.choice`
    : `constraint.readonly.option`;
  const inputRef = useRef();
  const inputType = multiple ? "checkbox" : "radio";
  const inputId = `${id}_input`;
  inputRef.nullCanHappen = true; // virtualization
  const [checkableRootProps, checkableProps, controlChildrenWrapperProps] =
    useCheckableProps({
      readOnlyMessage: naviI18n(readOnlyMessageKey, props),
      ...rest,
      ref: inputRef,
      id: inputId,
      type: inputType,
      deselectable,
      defaultChecked: defaultSelected,
      ...(hasSelectedProp ? { checked: selected } : null),
    });
  const { checked, value, basePseudoState, children } = checkableProps;
  const readOnly = basePseudoState[":read-only"];
  const realInputContextValue = useMemo(() => {
    return {
      id: inputId,
      type: inputType,
      checked,
      readOnly,
      value,
      deselectable,
    };
  }, [inputId, inputType, checked, readOnly, value, deselectable]);

  return (
    <Next
      id={id}
      index={index}
      matchInfo={matchInfo}
      filtered={filtered}
      hidden={hidden}
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
      onClick={onClick}
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
