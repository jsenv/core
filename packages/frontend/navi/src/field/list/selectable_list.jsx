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
import { useContext, useId, useRef } from "preact/hooks";

import { BoxForwardedPropsContext } from "@jsenv/navi/src/box/box.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { useFocusGroup } from "@jsenv/navi/src/utils/focus/use_focus_group.js";
import { Field } from "../field.jsx";
import { fieldPropSet } from "../field_prop_set.js";
import { Input } from "../input/input.jsx";
import { useFieldGroupProps } from "../use_field_group_props.jsx";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";
import { List, ListItem } from "./list.jsx";

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

    &[data-focus-within] {
      .navi_list_item {
        &[data-focus-visible] {
          --x-list-item-color: var(--list-item-color-keyboard-pointed);
          --x-list-item-background-color: var(
            --list-item-background-color-keyboard-pointed
          );
        }

        /* Selected must win over pointed-by-keyboard */
        &[data-selected] {
          --x-list-item-color: var(--list-item-color-selected);
          --x-list-item-background-color: var(
            --list-item-background-color-selected
          );
          /* Selected + pointed by keyboard: use keyboard color as fallback
           so that if --list-item-background-color-selected is reset the
           keyboard-pointed highlight still shows. */
          &[data-focus-visible] {
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
    /* Hover (mouse) */
    --list-item-color-hover: var(--list-item-color);
    --list-item-background-color-hover: light-dark(#f5f5f5, #2a2a2a);
    /* Pointed by mouse — subtle, just a shade above background */
    --list-item-color-mouse-pointed: var(--list-item-color);
    --list-item-background-color-mouse-pointed: light-dark(#ebebeb, #303030);
    /* Pointed by keyboard — subtle light blue highlight */
    --list-item-color-keyboard-pointed: var(--list-item-color);
    --list-item-background-color-keyboard-pointed: light-dark(#c2dcff, #1c3a6e);
    /* Selected — vivid blue accent */
    --list-item-color-selected: light-dark(#ffffff, #ffffff);
    --list-item-background-color-selected: light-dark(#1a73e8, #2b5fcc);
    /* Disabled */
    --list-item-color-disabled: light-dark(#aaa, #555);
    --list-item-background-color-disabled: var(--list-item-background-color);

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
    &[data-selected] {
      --x-list-item-color: var(--list-item-color-selected);
      --x-list-item-background-color: var(
        --list-item-background-color-selected
      );
      &[data-hover] {
        /* Here important should no beed need, but for some reason it is */
        --x-list-item-background-color: var(
          --list-item-background-color-selected,
          var(--list-item-background-color-mouse-pointed)
        ) !important;
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
  const defaultName = useId();
  // we allow ourselves to auto-generate a name
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  props.name = props.name || `listbox_${defaultName}`;
  const { ref, multiple } = props;
  const fieldProps = useFieldGroupProps(props, {
    fieldType: "list",
    childComponentType: multiple ? "checkbox" : "radio",
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
  useFocusGroup(ref, { direction: "both", loop: true });

  const listVnode = (
    <List
      as="fieldset"
      aria-multiselectable={multiple ? "true" : undefined}
      {...fieldProps}
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

export const Selectable = (props) => {
  const { index, id, highlight, hidden, filtered, value, selected, children } =
    props;
  const multiple = useContext(SelectableListMultipleContext);
  const inputType = multiple ? "checkbox" : "radio";
  const pseudoStateSelector = multiple ? ".navi_checkbox" : ".navi_radio";

  return (
    <ListItem
      id={id}
      index={index}
      highlight={highlight}
      filtered={filtered}
      hidden={hidden}
    >
      <Field
        requiredMessage={naviI18n(`list_item.readonly`, { value })}
        padding="m"
        flex
        alignY="center"
        spacing="s"
        expandX
        {...props}
        pseudoStateSelector={pseudoStateSelector}
        baseChildPropSet={SELECTABLE_REAL_INPUT_CHILD_PROP_SET}
        hasChildUsingForwardedProps
      >
        <SelectableRealInput type={inputType} selected={selected} />
        {children}
      </Field>
    </ListItem>
  );
};
const SELECTABLE_REAL_INPUT_CHILD_PROP_SET = new Set([
  ...fieldPropSet,
  "selected",
]);
const SelectableRealInput = ({ type, selected }) => {
  const inputProps = useContext(BoxForwardedPropsContext);

  return <Input {...inputProps} type={type} checked={selected} />;
};
Selectable.Input = () => {
  return "coucou";
};
