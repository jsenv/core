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
import { Input } from "../input/input.jsx";
import { useFieldGroupProps } from "../use_field_group_props.jsx";
import { dispatchRequestAction } from "../validation/custom_constraint_validation.js";
import { List, ListItem } from "./list.jsx";

const css = /* css */ `
  fieldset.navi_list_container {
    margin: 0; /* Reset margin that might come from fieldset */
    padding: 0; /* Reset padding that might come from fieldset */
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
  const { index, id, highlight, hidden, filtered, value, children } = props;
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
        hasChildUsingForwardedProps
      >
        <SelectableInput inputType={inputType} />
        {children}
      </Field>
    </ListItem>
  );
};
const SelectableInput = ({ inputType }) => {
  const inputProps = useContext(BoxForwardedPropsContext);
  return <Input {...inputProps} type={inputType} />;
};
Selectable.Input = () => {
  return "coucou";
};
