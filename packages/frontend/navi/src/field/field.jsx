import { useContext, useId, useMemo, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  DisabledContext,
  FieldContext,
  LoadingContext,
  ReadOnlyContext,
  RequiredContext,
} from "./field_context.js";
import { extractMessageAndRemainingProps } from "./validation/constraint_message.js";

const css = /* css */ `
  @layer navi {
    [data-navi-field] {
      .navi_checkbox {
        --margin: 0;
      }
      .navi_radio {
        --margin: 0;
      }
    }

    label[data-navi-field] {
      &[data-interactive] {
        cursor: pointer;
        user-select: none;
      }
      &[data-readonly],
      &[data-disabled] {
        color: rgba(0, 0, 0, 0.5);
        cursor: default;
      }
    }

    [data-navi-field-container] {
      --field-spacing: var(--navi-xs);

      > * + .navi_label {
        padding-left: var(--field-spacing);
      }
      > .navi_label:first-child {
        padding-right: var(--field-spacing);
      }
      &[data-vertical] > .navi_label:first-child {
        padding-bottom: var(--field-spacing);
      }

      &[data-interactive] {
        .navi_label {
          cursor: pointer;
          /* When label is interactive ability to select text oftens conflicts with other click interactions */
          user-select: none;
        }
      }
      &[data-readonly],
      &[data-disabled] {
        .navi_label {
          color: rgba(0, 0, 0, 0.5);
          cursor: default;
        }
      }
    }
  }
`;

/**
 * Field — a semantic wrapper that connects a label to a form control.
 *
 * It generates a stable `fieldId` (or accepts an explicit `id`) that is
 * automatically forwarded to the `Label` inside the field as `htmlFor` and to
 * any interactive control (Picker, Input, …) as its `id`, so clicking the
 * label focuses the control without requiring manual wiring.
 *
 * It also tracks the readOnly / disabled / interactive state reported by its
 * child control and reflects it on the `Label` (dimmed color, cursor change).
 *
 * Props:
 *   id        — optional explicit id used as the field id instead of the auto-generated one
 *   vertical  — shorthand for flex="y" + alignX="start"
 *   children  — any JSX; should contain a `Label` and a form control
 *   ...rest   — forwarded to the wrapping `<div>` (className, style, flex, spacing, …)
 *
 * @example
 * <Field vertical spacing="s">
 *   <Label>Date de début</Label>
 *   <Input name="start_date" required />
 * </Field>
 */
export const Field = (props) => {
  import.meta.css = css;
  const refDefault = useRef();
  props.ref = props.ref || refDefault;
  const { as, vertical } = props;
  if (as === undefined && !vertical) {
    props.as = "label";
  }
  if (props.as === "label") {
    return <FieldAsLabel {...props} />;
  }
  return <FieldAsContainer {...props} />;
};
const FieldAsLabel = (props) => {
  return <FieldUI {...props} />;
};

const FieldAsContainer = (props) => {
  const idDefault = useId();
  const fieldId = `field_${idDefault}`;
  props.id = props.id || fieldId;

  return (
    <FieldUI
      {...props}
      data-navi-field-container=""
      styleCSSVars={FieldCSSVars}
    />
  );
};
const FieldCSSVars = {
  spacing: "--field-spacing",
};
const FieldUI = (props) => {
  import.meta.css = css;
  const { vertical } = props;
  const { id, name, disabled, readOnly, required, loading, ...rest } = props;
  // Collect constraint message props so child fields can inherit them via context.
  const [fieldMessageProps, remainingProps] =
    extractMessageAndRemainingProps(rest);
  const fieldMessagePropsRef = useRef(fieldMessageProps);
  fieldMessagePropsRef.current = fieldMessageProps;
  const [disabledByChild, setDisabledByChild] = useState(false);
  const [readOnlyFromChild, setReadOnlyFromChild] = useState(false);
  const [interactive, setInteractive] = useState(false);

  const parentFieldContext = useContext(FieldContext);
  const parentFieldDisabled = useContext(DisabledContext);
  const parentFieldReadOnly = useContext(ReadOnlyContext);
  const parentFieldRequired = useContext(RequiredContext);
  const parentFieldLoading = useContext(LoadingContext);
  const nameResolved = name || parentFieldContext?.name;
  const disabledResolved = disabled || parentFieldDisabled;
  const readOnlyResolved = readOnly || parentFieldReadOnly;
  const requiredResolved = required || parentFieldRequired;
  const loadingResolved = loading || parentFieldLoading;
  const contextValue = useMemo(
    () => ({
      id,
      name: nameResolved,
      setReadOnly: setReadOnlyFromChild,
      setDisabled: setDisabledByChild,
      setInteractive,
      messagePropsRef: fieldMessagePropsRef,
    }),
    [id, nameResolved],
  );
  let childrenWithContext;
  if (props.children === undefined) {
  } else {
    childrenWithContext = (
      <FieldContext.Provider value={contextValue}>
        <DisabledContext.Provider value={disabledResolved}>
          <ReadOnlyContext.Provider value={readOnlyResolved}>
            <RequiredContext.Provider value={requiredResolved}>
              <LoadingContext.Provider value={loadingResolved}>
                {props.children}
              </LoadingContext.Provider>
            </RequiredContext.Provider>
          </ReadOnlyContext.Provider>
        </DisabledContext.Provider>
      </FieldContext.Provider>
    );
  }

  // a field inteface can make the field component
  // disabled/readonly when that field interface is disabled/readonly
  // this is the only bottom up communication there is
  // (apart from action requested by child which cause ancestor action to execute)
  const disabledOrByChild = disabledResolved || disabledByChild;
  const readOnlyOrByChild = readOnlyResolved || readOnlyFromChild;
  const fieldProps = {
    "data-navi-field": "",
    "data-interactive": interactive ? "" : undefined,
    ...remainingProps,
    "children": childrenWithContext,
    "pseudoClasses": FieldPseudoClasses,
    "basePseudoState": {
      ":disabled": disabledOrByChild,
      ":read-only": readOnlyOrByChild,
      ...remainingProps.basePseudoState,
    },
  };

  return (
    <Box
      flex={vertical ? "y" : undefined}
      alignX={vertical ? "start" : undefined}
      data-vertical={vertical ? "" : undefined}
      {...fieldProps}
    />
  );
};

const FieldPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

export const Label = (props) => {
  const { children, htmlFor, ...rest } = props;
  const ctx = useContext(FieldContext);
  const fieldId = ctx?.fieldId;

  return (
    <Box
      as="label"
      htmlFor={htmlFor || fieldId}
      baseClassName="navi_label"
      pseudoClasses={LabelPseudoClasses}
      {...rest}
    >
      {children}
    </Box>
  );
};
const LabelPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
