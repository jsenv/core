import {
  dispatchCustomEvent,
  dispatchPublicCustomEvent,
  preventFocusNav,
} from "@jsenv/dom";
import { useComputed } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useMemo, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import {
  renderResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { getNetworkPolicyReadOnlyMessage } from "@jsenv/navi/src/action/network_policy.js";
import { constraintI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { compareTwoJsValues } from "@jsenv/navi/src/utils/compare_two_js_values.js";
import { moveFocusTo } from "@jsenv/navi/src/utils/focus/focus_transfer.js";
import { useFocusGroup } from "@jsenv/navi/src/utils/focus/use_focus_group.js";
import {
  ControlIdContext,
  ReadOnlyContext,
  ReadOnlyMessageContext,
} from "../control_context.js";
import { listItemBusyMessage } from "./list_item_blocked_message.js";
import {
  ControlChildrenWrapper,
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "../control_hooks.jsx";
import { getUIStateControllerById } from "../controller_registry.js";
import { uiStateHoldsNothing } from "../ui_state_controller.js";
import { Input } from "../input/input.jsx";
import { useCheckableProps } from "../input/use_checkable_props.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import { useGeneratedId } from "../../utils/use_generated_id.js";

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

      /* Pointed by mouse (hovered) — subtle, just a shade above background */
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
      /* Selected and hovered — the selected colors unless an item says
         otherwise. Reset here so an item hovered in an outer list does not
         hand its own to a nested one. */
      --list-item-color-selected-hover: initial;
      --list-item-background-color-selected-hover: initial;
      /* Placeholder — what the list means while it holds nothing */
      --list-item-color-placeholder: var(--list-item-color);
      --list-item-background-color-placeholder: color-mix(
        in srgb,
        var(--navi-accent-color) 12%,
        transparent
      );
      --list-item-border-color-placeholder: color-mix(
        in srgb,
        var(--navi-accent-color) 50%,
        transparent
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
      font-family: var(--navi-control-font-family, inherit);
      /* A selectable item is a control: it stands in a row with pickers and
         inputs (a horizontal list of choices), so it takes the control line
         with the control font — the same number of pixels tall as them. */
      line-height: var(--navi-control-line-height);
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
      /* The real input lies UNDER the content (z-index: -1, from the hidden
         appearance) so that nothing in the row has to be lifted above it to
         stay pressable — a press the content does not take falls through to
         it. A stacking context is what keeps that -1 between the row's own
         background and its content instead of sending the input behind the
         background, where no press would ever reach it. */
      isolation: isolate;
      /* The row's content is see-through to the pointer: a press on a word, on
         the padding, on the gap between two cells all reach the real input
         lying under it, and that is what makes the whole row the selection.
         What answers a press for itself is excepted further down. */
      pointer-events: none;

      [navi-selectable-real-input] {
        outline: none;
        opacity: 0;
        /* clip-path clips the hit area too, and this input's hit area is the
           whole row. */
        clip-path: none;
        cursor: var(--x-list-item-cursor);
        pointer-events: auto;
      }

      /* What says on its own what a press on it does keeps that press: a link
         goes where it points, a button does what it says, a control takes its
         own value. The row's selection is what is left — everywhere the row
         draws nothing to press. Said of what an element IS rather than of
         navi's own components: a row is markup like any other, and an <a href>
         in it is a link whoever wrote it.
         The proxy drawn as the row's mark (the visible checkbox) stays out: it
         is a picture OF the selection, not a second way to ask for it, and
         being out of the pointer's reach is how the ROW is found as the place
         a refusal about the selection is said (see findControlProxy). */
      &:not([data-disabled]) {
        a[href],
        button,
        select,
        textarea,
        input:not([navi-selectable-real-input], [navi-control-proxy-for]),
        [navi-control]:not(
          [navi-control-proxy-for],
          :has([navi-control-proxy-for])
        ) {
          pointer-events: auto;
        }
      }

      /* A popup opened from the row is not part of the row: it is shown over
         the page — in the browser's own top layer for a modal one — and only
         happens to be declared here. pointer-events is inherited, so without
         this it inherits the row's own "none" and nothing inside it can be
         clicked, however far from the row it is painted. Matched on what makes
         an element a popup to the browser rather than on navi's own attribute:
         anything shown over the page has the same claim, navi's or not. */
      dialog:not([navi-popup-group]:not(:modal)),
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
          --x-list-item-color: var(
            --list-item-color-selected-hover,
            var(--list-item-color-selected)
          ) !important;
          --x-list-item-background-color: var(
            --list-item-background-color-selected-hover,
            var(--list-item-background-color-selected)
          ) !important;
        }

        input,
        .navi_picker_content {
          color: revert;
        }
      }
    }

    /* After hover/pointed: what the empty list means stays drawn under the
       pointer, as a selection does. */
    &[data-placeholder] {
      --x-list-item-border-color: var(--list-item-border-color-placeholder);
      --x-list-item-background-color: var(
        --list-item-background-color-placeholder
      );
      --x-list-item-color: var(--list-item-color-placeholder);
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

// The keys heard while the focus is parked on the list (see focusParking in
// ListSelectable): the walk goes on from the item that held it.
const PARKED_KEY_GOALS = {
  ArrowDown: "next",
  ArrowRight: "next",
  ArrowUp: "previous",
  ArrowLeft: "previous",
  Home: "first",
  End: "last",
};
const getItemName = (itemEl) => itemEl.getAttribute("navi-list-item-real");
const getItemIndex = (itemEl) =>
  Number(itemEl.getAttribute("navi-list-item-index"));
const getRealInput = (itemEl) =>
  itemEl.querySelector("[navi-selectable-real-input]");
// What the keys may land on: an item whose real input could take the focus —
// not disabled, not inert nor hidden from assistive technology (an item a
// search keeps in place but invisible, see searchNoMatchMode). The part of
// the focus group's test that can apply to an item, read off attributes: no
// style is read, and the keys ask it of every item they walk past.
const isNavigable = (itemEl) => {
  const realInput = getRealInput(itemEl);
  return (
    Boolean(realInput) &&
    !realInput.disabled &&
    !realInput.closest('[inert], [aria-hidden="true"]')
  );
};

const SelectableListMultipleContext = createContext(false);
// A single-select list whose selected row, pressed again, lets go: what its
// rows' radios need to know to answer the press (see `deselectable` on Input).
const SelectableListDeselectableContext = createContext(false);
// A row of a selectable list is selectable — the list is what decides, and a
// row says nothing unless it wants out (`selectable={false}` on a row that is
// only there to be read). Also set to false by a non-selectable list, so a list
// nested inside a selectable row does not inherit the outer list's answer.
const ListSelectableContext = createContext(false);
// The values a selectable list means while it holds nothing (its
// `placeholder`), or null while it holds something.
const ListPlaceholderContext = createContext(null);
// How an item of a selectable list hands the focus to the list when it leaves
// the DOM holding it, and takes it back when drawn again (see focusParking).
const SelectableListFocusParkingContext = createContext(null);
/**
 * Where an item stands in its list, for assistive technology: `posinset` and
 * `setsize` counted over the whole collection, not over the items a window
 * happens to draw. Provided by the item (see ListItemReal), read by the real
 * input a selectable item carries, a radio announcing "3 of 120".
 */
export const ListItemPositionContext = createContext(null);
// Interactive variant: manages hover/keyboard/selection state and handles the
// navi event protocol. When an action is provided it binds the action to ui state
// and fires it on select. When only uiAction is provided it calls it directly.
export const ListSelectableResolver = (props) => {
  const Next = useNextResolver();

  if (props.selectable) {
    return renderResolver(ListSelectable, props);
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
  const defaultName = useGeneratedId();
  props.name = props.name || `listbox_${defaultName}`;
  const {
    ref,
    listItems,
    multiple,
    deselectable,
    focusGroupDirection,
    focusGroupWrap,
    placeholder,
  } = props;
  const [listControlRootProps, listControlProps, childrenWrapperProps] =
    useControlgroupProps(
      {
        // The defaults of the group this IS (see CheckboxGroup / RadioGroup):
        // what a selectable list shows is a claim about what was accepted, so
        // a run that ends without an answer puts the rows back where they were
        // — a row left ticked over a refusal says the opposite of what
        // happened, and the error callout beside it does not untick it.
        resetOnCancel: true,
        resetOnAbort: true,
        resetOnError: true,
        ...props,
        // An input's placeholder is an attribute of its own; a list's is read
        // here, by its items.
        placeholder: undefined,
      },
      {
        // A list draws the rows it needs and no more, so a selected row may be
        // scrolled out of the window or filtered out of the view: the default
        // aggregate of these two groups keeps a value whose row is not drawn
        // (see GROUP_DEFAULTS in ui_state_controller.js). `stateType` is what
        // an emptied multiple list says — `[]`, not `undefined`, which a bound
        // stateSignal reads as "nothing decided here, go back to the default"
        // (see docs/control_value.md).
        stateType: multiple ? "array" : "",
        controlType: multiple ? "checkbox_group" : "radio_group",
      },
    );
  const uiGroupStateController = getUIStateControllerById(listControlProps.id);
  // A computed boolean: the list renders again when it starts or stops holding
  // something, not at every selection.
  const holdsNothing = useComputed(() => {
    const uiState = uiGroupStateController.uiStateSignal.value;
    return uiState === null || uiStateHoldsNothing(uiState);
  }).value;
  // Kept while equal by content: an app writes `placeholder={[ownLevel]}`, a new
  // array at each render, and every item reads it.
  const placeholderRef = useRef(null);
  if (!holdsNothing || !placeholder || placeholder.length === 0) {
    placeholderRef.current = null;
  } else if (
    placeholderRef.current === null ||
    !compareTwoJsValues(placeholderRef.current, placeholder)
  ) {
    placeholderRef.current = placeholder;
  }
  const placeholderShown = placeholderRef.current;
  useFocusGroup(ref, {
    direction: focusGroupDirection,
    wrap: focusGroupWrap,
    // Up/Down navigate between list items only (the visually-hidden real inputs).
    ySelector: "[navi-selectable-real-input]",
  });

  // The item the keyboard points at: the one the focus is on while it is in
  // the list, else the one a field driving the list (<Input navi-list>) or a
  // command walking it (--navi-next…) moved to. Kept by its NAME in the list
  // (`navi-list-item-real`: a run names its items whatever DOM id they wear),
  // and checked against the items each time it is used — what it names may
  // have been filtered out, hidden by a search or scrolled out of the window
  // since. Announced with navi_current_change (bubbling), so a field driving
  // the list can say where the keys point (aria-activedescendant).
  const currentRef = useRef({ name: null, realInputId: null });
  const setCurrent = (name, itemEl, event) => {
    const realInput = itemEl ? getRealInput(itemEl) : null;
    // An item not drawn keeps the DOM ids it was last drawn with: they are
    // its own, and it is drawn again with them.
    const realInputId = realInput
      ? realInput.id
      : name === currentRef.current.name
        ? currentRef.current.realInputId
        : null;
    const previous = currentRef.current;
    if (previous.name === name && previous.realInputId === realInputId) {
      return;
    }
    currentRef.current = { name, realInputId };
    const listEl = ref.current;
    if (!listEl) {
      return;
    }
    if (name === null) {
      listEl.removeAttribute("navi-current-id");
    } else {
      listEl.setAttribute("navi-current-id", name);
    }
    dispatchPublicCustomEvent(listEl, "navi_current_change", {
      event,
      id: name,
      realInputId,
    });
  };
  // The items of THIS list that are drawn, in DOM order: a list nested in an
  // item has items of its own.
  const getOwnItemElements = () => {
    const listEl = ref.current;
    if (!listEl) {
      return [];
    }
    const itemsEl = listEl.querySelector(".navi_list");
    const itemEls = [];
    for (const itemEl of listEl.querySelectorAll("[navi-list-item-real]")) {
      if (itemEl.closest(".navi_list") === itemsEl) {
        itemEls.push(itemEl);
      }
    }
    return itemEls;
  };
  const findOwnItemElement = (name) => {
    for (const itemEl of getOwnItemElements()) {
      if (getItemName(itemEl) === name) {
        return itemEl;
      }
    }
    return null;
  };
  // The current item as it stands now: drawn and navigable, or held by a run
  // outside what it draws (the keys go on from its place, and acting on it
  // brings it back into view). Null when it names nothing any more — filtered
  // out, hidden by a search, removed — or nothing at all.
  const resolveCurrent = () => {
    const { name } = currentRef.current;
    if (name === null) {
      return null;
    }
    const itemEl = findOwnItemElement(name);
    if (itemEl) {
      return isNavigable(itemEl)
        ? { name, index: getItemIndex(itemEl), itemEl }
        : null;
    }
    const index = listItems.locateItem(name);
    if (index === null || !listItems.standsUndrawnAt(index)) {
      return null;
    }
    return { name, index, itemEl: null };
  };
  // Walking the collection from an index, one item at a time — not what the
  // window happens to draw: the first item the keys may land on. Drawn, it is
  // judged on the spot; a run's item not drawn is brought into view and
  // judged once drawn (see goTo).
  const findTarget = (fromIndex, step) => {
    const itemElByIndex = new Map();
    for (const itemEl of getOwnItemElements()) {
      itemElByIndex.set(getItemIndex(itemEl), itemEl);
    }
    const total = listItems.totalSignal.peek();
    for (
      let index = fromIndex + step;
      index >= 0 && index < total;
      index += step
    ) {
      const itemEl = itemElByIndex.get(index);
      if (itemEl) {
        if (isNavigable(itemEl)) {
          return { name: getItemName(itemEl), index, itemEl };
        }
        continue;
      }
      if (listItems.standsUndrawnAt(index)) {
        return { name: listItems.itemNameAt(index), index, itemEl: null };
      }
    }
    return null;
  };
  // Brought into view, then made current — and given the focus when the
  // keys came from a focus parked on the list (see parkFocus). An item a run
  // had not drawn is judged once drawn: one the keys may not land on (a
  // disabled one) is walked past, the same way.
  const goTo = (target, event, { step, focus }) => {
    if (target.name !== undefined) {
      setCurrent(target.name, target.itemEl, event);
    }
    dispatchCustomEvent(ref.current, "navi_request_reveal", {
      event,
      id: target.name,
      index: target.index,
      onRevealed: (itemEl) => {
        if (!isNavigable(itemEl)) {
          const next = findTarget(target.index, step);
          if (next && next.index !== target.index) {
            goTo(next, event, { step, focus });
          }
          return;
        }
        setCurrent(getItemName(itemEl), itemEl, event);
        if (focus) {
          moveFocusTo(getRealInput(itemEl));
        }
      },
    });
  };
  // "previous"/"next", not "up"/"down": a list is a line of items whichever
  // way it is laid out, and a horizontal one walks sideways. The keys that
  // drive it (arrows, Home/End) map onto that where they are heard, and so do
  // the commands (--navi-previous / --navi-next / --navi-first / --navi-last).
  // "none": the text of a field driving the list changed, and what the keys
  // pointed at answered the text before — nothing is current until the keys
  // pick something again.
  // Returns whether the list answered: a key the list does not answer stays
  // with whoever pressed it (the caret of the field, see InputWithList).
  const navigate = (goal, event, { focus } = {}) => {
    if (goal === "none") {
      setCurrent(null, null, event);
      return false;
    }
    const current = resolveCurrent();
    if (!current && currentRef.current.name !== null) {
      setCurrent(null, null, event);
    }
    let target;
    let step = 1;
    if (goal === "last") {
      step = -1;
      target = findTarget(listItems.totalSignal.peek(), step);
    } else if (!current || goal === "first") {
      target = findTarget(-1, step);
    } else {
      step = goal === "previous" ? -1 : 1;
      target = findTarget(current.index, step);
    }
    if (!target) {
      // At an end of the list: the key is the list's, nothing moves.
      return Boolean(current);
    }
    goTo(target, event, { step, focus });
    return true;
  };

  const getChildController = (itemEl) => {
    const realInput = getRealInput(itemEl);
    return realInput
      ? uiGroupStateController.findChildById(realInput.id)
      : null;
  };
  const requestSelect = (itemEl, e) => {
    const childController = getChildController(itemEl);
    if (!childController) {
      return;
    }
    dispatchRequestInteraction(ref.current, {
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
          allowed: () => childController.setUIState(childController.value, e),
        });
      },
    });
  };
  const requestUnselect = (itemEl, e) => {
    const childController = getChildController(itemEl);
    if (!childController) {
      return;
    }
    dispatchRequestInteraction(ref.current, {
      event: e,
      name: "unselect",
      prevented: () => e.preventDefault(), // tell the requester that we don't want to unselect this item
      allowed: () => childController.setUIState(undefined, e),
    });
  };

  // The focus is not lost when the item holding it leaves the DOM — the
  // window sliding past it under a wheel or a PageDown, a search taking it
  // out: it is handed to the list before the item goes (see
  // ListItemSelectable), and goes back to the item as soon as it is drawn
  // again. The keys pressed meanwhile go on from it. The list takes the focus
  // only for that while (tabindex -1, removed when the focus leaves it).
  const focusParking = useMemo(
    () => ({
      park: (itemEl) => {
        const listEl = ref.current;
        const activeElement = document.activeElement;
        if (
          !listEl ||
          !listEl.isConnected ||
          !activeElement ||
          !itemEl.contains(activeElement)
        ) {
          return;
        }
        setCurrent(getItemName(itemEl), itemEl, null);
        listEl.setAttribute("tabindex", "-1");
        moveFocusTo(listEl);
      },
      giveBack: (itemEl) => {
        const listEl = ref.current;
        if (
          !listEl ||
          document.activeElement !== listEl ||
          getItemName(itemEl) !== currentRef.current.name
        ) {
          return;
        }
        moveFocusTo(getRealInput(itemEl));
      },
    }),
    [],
  );
  useLayoutEffect(() => {
    const listEl = ref.current;
    const onFocusOut = (e) => {
      if (e.target === listEl) {
        listEl.removeAttribute("tabindex");
      }
    };
    // Heard before the focus group's own arrow keys (see initFocusGroup),
    // which have no item to start from while the focus is on the list.
    const onKeyDownWhileParked = (e) => {
      if (e.target !== listEl) {
        return;
      }
      const goal = PARKED_KEY_GOALS[e.key];
      if (!goal) {
        return;
      }
      if (navigate(goal, e, { focus: true })) {
        e.preventDefault();
        preventFocusNav(e);
      }
    };
    listEl.addEventListener("focusout", onFocusOut);
    listEl.addEventListener("keydown", onKeyDownWhileParked, { capture: true });
    return () => {
      listEl.removeEventListener("focusout", onFocusOut);
      listEl.removeEventListener("keydown", onKeyDownWhileParked, {
        capture: true,
      });
    };
  }, []);

  // On mount: the first selected item is current, else the first one the
  // empty list means (its placeholder), else the first the keys may land on.
  // After that, the focus and the keys move it.
  useLayoutEffect(() => {
    const itemEls = getOwnItemElements();
    const findItem = (predicate) =>
      itemEls.find((itemEl) => predicate(itemEl) && isNavigable(itemEl));
    const initialEl =
      findItem((itemEl) => getRealInput(itemEl)?.checked) ||
      findItem((itemEl) => itemEl.hasAttribute("data-placeholder")) ||
      findItem(() => true);
    if (initialEl) {
      setCurrent(getItemName(initialEl), initialEl, null);
    }
  }, []);

  // The group's contexts stand around the whole list, never between the <ul>
  // and the rows: the walk that gives the rows their places is over the <ul>'s
  // children, and a component sitting there is one child — every row would then
  // stand in a single slot, and reordering them (a search) would move nothing.
  const listVnode = (
    <ControlgroupChildrenWrapper {...childrenWrapperProps}>
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
        placeholder={undefined}
        focusGroupDirection={undefined}
        focusGroupWrap={undefined}
        // Track focus inside the list: whichever item gets focus becomes current.
        onFocusIn={(e) => {
          const realInput = e.target.closest("[navi-selectable-real-input]");
          if (!realInput) {
            return;
          }
          const itemEl = realInput.closest("[navi-list-item-real]");
          if (itemEl && getOwnItemElements().includes(itemEl)) {
            setCurrent(getItemName(itemEl), itemEl, e);
          }
        }}
        // --navi-select / --navi-unselect: an item named as the list names it
        // (see List.Item's `id`), among the items drawn — the control it
        // carries exists only while it is.
        onnavi_request_select={(e) => {
          const { id } = e.detail;
          if (id === undefined) {
            return;
          }
          const itemEl = findOwnItemElement(String(id));
          if (itemEl) {
            requestSelect(itemEl, e);
          }
        }}
        onnavi_request_unselect={(e) => {
          const { id } = e.detail;
          if (id === undefined) {
            return;
          }
          const itemEl = findOwnItemElement(String(id));
          if (itemEl) {
            requestUnselect(itemEl, e);
          }
        }}
        onnavi_request_nav={(e) => {
          if (navigate(e.detail.goal, e)) {
            e.detail.onAnswer?.();
          }
        }}
        // Enter: the item the keys point at, as it stands now — brought back
        // into view first when it was scrolled out of the window. With none,
        // the key is still the list's and does nothing: a form around a field
        // driving the list is not submitted by a key meant for the list.
        onnavi_request_activate={(e) => {
          e.detail.onAnswer?.();
          const current = resolveCurrent();
          if (!current) {
            if (currentRef.current.name !== null) {
              setCurrent(null, null, e);
            }
            return;
          }
          const activate = (itemEl) => {
            const childController = getChildController(itemEl);
            const isSelected = childController && childController.uiState;
            if ((multiple || deselectable) && isSelected) {
              requestUnselect(itemEl, e);
            } else {
              requestSelect(itemEl, e);
            }
          };
          if (current.itemEl) {
            activate(current.itemEl);
            return;
          }
          dispatchCustomEvent(ref.current, "navi_request_reveal", {
            event: e,
            id: current.name,
            index: current.index,
            onRevealed: (itemEl) => {
              if (isNavigable(itemEl)) {
                activate(itemEl);
              }
            },
          });
        }}
      >
        {props.children}
      </Next>
    </ControlgroupChildrenWrapper>
  );
  return (
    <ListSelectableContext.Provider value={true}>
      <SelectableListMultipleContext.Provider value={multiple}>
        <SelectableListDeselectableContext.Provider
          value={Boolean(deselectable)}
        >
          <ListPlaceholderContext.Provider value={placeholderShown}>
            <SelectableListFocusParkingContext.Provider value={focusParking}>
              {listVnode}
            </SelectableListFocusParkingContext.Provider>
          </ListPlaceholderContext.Provider>
        </SelectableListDeselectableContext.Provider>
      </SelectableListMultipleContext.Provider>
    </ListSelectableContext.Provider>
  );
};

const SelectableRealInputContext = createContext(null);

/**
 * What the selectable `List.Item` around it holds, read by what that row
 * draws: the "Choose"/"Cancel" of a row, a mark on the chosen one. The row's
 * own state, read where it is, rather than a value re-derived beside the list
 * — that one goes stale as soon as the list moves on its own (a press inside
 * a popup, a reset, a cancel).
 *
 * @returns {{ selected: boolean, placeholder: boolean, readOnly: boolean, value: any } | null}
 *   `null` outside a row of a selectable list. `placeholder`: the list holds
 *   nothing and this item is what that means (see List's `placeholder`).
 */
export const useListItemState = () => {
  const realInput = useContext(SelectableRealInputContext);
  if (!realInput) {
    return null;
  }
  return {
    selected: Boolean(realInput.checked),
    placeholder: realInput.placeholder,
    readOnly: Boolean(realInput.readOnly),
    value: realInput.value,
  };
};

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
  // An item a search took out renders nothing, so it carries no control: a
  // control registered without an element would be one the keys and the
  // commands act on with nothing to act on. Its value, when selected, stays
  // with the list (an item not drawn keeps its selection, see
  // useControlgroupProps in ListSelectable).
  if (selectable && !props.filtered) {
    return renderResolver(ListItemSelectable, { ...props, selectable: true });
  }
  return <Next {...props} />;
};
const ListItemSelectable = (props) => {
  const Next = useNextResolver();
  const defaultId = useGeneratedId();
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
    // True of the ROW as much as of the control it carries, so both are told.
    // Left in `rest` they would reach the hidden input alone — the control
    // system claims them (they are control props) and the row would never see
    // them, which for a row means no outline, no dimming, no press swallowed
    // and none of the buttons it contains held back (see ListItemReal). Any
    // prop a row and a control both understand belongs here.
    loading,
    readOnly,
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
  // from above is the LIST's, and that is the whole answer — said as the
  // selection where several things are taken, as the choice where one thing
  // is. Said of each row in turn, "this option is not available" describes
  // something else entirely: a list where each row happens to be unavailable
  // for its own reasons, which is what a row held on its own says.
  //
  // A list waiting on something is not unavailable, it is not answering yet —
  // busy rather than read-only (see BUSY_CONSTRAINT, which is asked first),
  // and the wait is about the same thing the read-only would be about.
  //
  // Unless what made the list read-only says it better: in words of its own (a
  // picker's or a list's readOnlyMessage), or because it is the network
  // policy holding the write the selection would make.
  const readOnlyFromAbove = useContext(ReadOnlyContext);
  const readOnlyMessageFromAbove = useContext(ReadOnlyMessageContext);
  const readOnlyMessageKey = readOnlyFromAbove
    ? multiple
      ? `constraint.readonly.selection`
      : `constraint.readonly.choice`
    : `constraint.readonly.option`;
  // Handed to the row as well as to the control: whichever of the two catches
  // the press answers it, and they must not answer it differently.
  const readOnlyMessageResolved =
    props.readOnlyMessage ??
    (readOnlyFromAbove ? readOnlyMessageFromAbove : undefined) ??
    (readOnlyFromAbove === "network-policy"
      ? getNetworkPolicyReadOnlyMessage()
      : constraintI18n(readOnlyMessageKey, props));
  const busyMessageResolved =
    props.busyMessage ??
    (loading
      ? listItemBusyMessage(loading, props)
      : constraintI18n(
          multiple ? `constraint.busy.selection` : `constraint.busy.choice`,
          props,
        ));
  const inputRef = useRef();
  // Handing the focus to the list before the item leaves the DOM holding it,
  // taking it back when drawn again (see focusParking in ListSelectable).
  // Read on the item element itself: the layout cleanup runs while the item
  // is still in the document, before its children are taken out with it.
  const focusParking = useContext(SelectableListFocusParkingContext);
  const itemRef = props.ref;
  useLayoutEffect(() => {
    const itemEl = itemRef.current;
    if (!itemEl || !focusParking) {
      return undefined;
    }
    focusParking.giveBack(itemEl);
    return () => {
      focusParking.park(itemEl);
    };
  }, []);
  const inputType = multiple ? "checkbox" : "radio";
  const inputId = `${id}_input`;
  inputRef.nullCanHappen = true; // virtualization
  const [checkableRootProps, checkableProps, controlChildrenWrapperProps] =
    useCheckableProps(
      {
        readOnlyMessage: readOnlyMessageResolved,
        // What the row itself is waiting for when it says so, the wait of the
        // list around it otherwise — said as the selection where several things
        // are taken, as the choice where one thing is.
        busyMessage: busyMessageResolved,
        loading,
        readOnly,
        ...rest,
        ref: inputRef,
        id: inputId,
        type: inputType,
        deselectable,
        defaultChecked: defaultSelected,
        ...(hasSelectedProp ? { checked: selected } : null),
      },
      // The host is the visually hidden input carrying the selection: the row
      // is what the person sees and presses (see onClick above).
      { listenersOn: "root" },
    );
  const { checked, value, basePseudoState, children } = checkableProps;
  // Everything holding the control back, not only the row's own `readOnly`
  // above: the list above it, a maxLengthGuard with no room left.
  const readOnlyResolved = basePseudoState[":read-only"];
  const placeholderValues = useContext(ListPlaceholderContext);
  const isPlaceholder =
    placeholderValues !== null &&
    placeholderValues.some((placeholderValue) =>
      compareTwoJsValues(placeholderValue, value),
    );
  const realInputContextValue = useMemo(() => {
    return {
      id: inputId,
      type: inputType,
      checked,
      placeholder: isPlaceholder,
      readOnly: readOnlyResolved,
      value,
      deselectable,
    };
  }, [
    inputId,
    inputType,
    checked,
    isPlaceholder,
    readOnlyResolved,
    value,
    deselectable,
  ]);

  return (
    <Next
      id={id}
      index={index}
      matchInfo={matchInfo}
      filtered={filtered}
      hidden={hidden}
      selected={checked}
      navi-selectable=""
      spacing="s"
      flex
      alignY="center"
      {...checkableRootProps}
      pseudoClasses={SELECTABLE_PSEUDO_CLASSES}
      basePseudoState={{
        ":-navi-selected": checked,
        ":-navi-placeholder": isPlaceholder,
        ":-navi-pointed": pointed,
        ...basePseudoState,
      }}
      ref={props.ref}
      onClick={onClick}
      loading={loading}
      readOnly={readOnly}
      readOnlyMessage={readOnlyMessageResolved}
      busyMessage={busyMessageResolved}
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
  ":-navi-placeholder",
];
const SelectableRealInput = (props) => {
  // A radio says where it stands in its group ("3 of 120"), counted over the
  // collection rather than over the radios drawn. A checkbox has no position
  // in ARIA: its item says it (see ListItemReal).
  const position = useContext(ListItemPositionContext);
  const positionProps =
    position && props.type === "radio"
      ? {
          "aria-posinset": position.posinset,
          "aria-setsize": position.setsize,
        }
      : null;
  // here for some reason we can't use <Input, so instead we use <Box
  // ideally we could use <Input but it would interfere with the control props we already create
  // in the ListItemSelectable
  return (
    <Box
      as="input"
      pseudoClasses={SELECTABLE_INPUT_PSEUDO_CLASSES}
      {...props}
      {...positionProps}
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
  const realInputState = useContext(SelectableRealInputContext);
  if (!realInputState) {
    throw new Error(
      "SelectableInput must be used within a row of a selectable List",
    );
  }
  // The item's placeholder state is drawn by the item, not by the mark.
  // eslint-disable-next-line no-unused-vars
  const { placeholder, ...selectableRealInputProps } = realInputState;

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
