import { useContext, useId, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { ControlIdContext, MessagePropsRefContext } from "./control_context.js";
import { extractMessageAndRemainingProps } from "./validation/constraint_message.js";

const css = /* css */ `
  @layer navi {
    .navi_label {
      &[data-control-connected] {
        cursor: pointer;
        user-select: none;
      }
      &[data-readonly],
      &[data-disabled] {
        color: rgba(0, 0, 0, 0.5);
        cursor: default;
      }
    }

    [navi-field] {
      --field-spacing: var(--navi-xs);

      > * + .navi_label {
        padding-left: var(--field-spacing);
      }
      > .navi_label:first-child {
        padding-right: var(--field-spacing);
      }
      &[data-vertical] {
        & > .navi_label:first-child {
          padding-right: 0;
          padding-bottom: var(--field-spacing);
        }
        & > * + .navi_label {
          padding-top: var(--field-spacing);
          padding-left: 0;
        }
      }

      .navi_checkbox {
        --margin: 0;
      }
      .navi_radio {
        --margin: 0;
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
 * <Field flex spacing="s">
 *   Date de début
 *   <Input name="start_date" required />
 * </Field>
 */
export const Field = (props) => {
  import.meta.css = css;
  const refDefault = useRef();
  props.ref = props.ref || refDefault;
  const { as } = props;

  if (as === "label") {
    return <FieldAsLabel {...props} />;
  }
  return <FieldAsContainer {...props} />;
};

const FieldAsLabel = (props) => {
  const { vertical, children } = props;
  const [messageProps, remainingProps] = extractMessageAndRemainingProps(props);
  const messagePropsRef = useRef();
  messagePropsRef.current = messageProps;

  return (
    <Label
      navi-field=""
      styleCSSVars={FieldCSSVars}
      flex={vertical ? "y" : undefined}
      alignX={vertical ? "start" : undefined}
      data-vertical={vertical ? "" : undefined}
      {...remainingProps}
      vertical={undefined}
      fieldId={undefined}
    >
      <MessagePropsRefContext.Provider value={messagePropsRef}>
        <ControlIdContext.Provider value={props.fieldId}>
          {children}
        </ControlIdContext.Provider>
      </MessagePropsRefContext.Provider>
    </Label>
  );
};
const FieldCSSVars = {
  spacing: "--field-spacing",
};
const FieldAsContainer = (props) => {
  import.meta.css = css;
  const { vertical, children } = props;
  const [messageProps, remainingProps] = extractMessageAndRemainingProps(props);
  const messagePropsRef = useRef();
  messagePropsRef.current = messageProps;
  const idDefault = useId();
  props.fieldId = props.fieldId || `field_${idDefault}`;

  return (
    <Box
      navi-field=""
      styleCSSVars={FieldCSSVars}
      flex={vertical ? "y" : undefined}
      alignX={vertical ? "start" : undefined}
      data-vertical={vertical ? "" : undefined}
      {...remainingProps}
      vertical={undefined}
      fieldId={undefined}
    >
      <MessagePropsRefContext.Provider value={messagePropsRef}>
        <ControlIdContext.Provider value={props.fieldId}>
          {children}
        </ControlIdContext.Provider>
      </MessagePropsRefContext.Provider>
    </Box>
  );
};

const FIELD_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

export const Label = (props) => {
  import.meta.css = css;
  const { children, htmlFor, ...rest } = props;
  const controlId = useContext(ControlIdContext);
  const [disabled, setDisabled] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [connected, setConnected] = useState(false);

  return (
    <Box
      as="label"
      htmlFor={htmlFor || controlId}
      baseClassName="navi_label"
      pseudoClasses={FIELD_PSEUDO_CLASSES}
      data-control-connected={connected ? "" : undefined}
      basePseudoState={{
        ":disabled": disabled,
        ":read-only": readOnly,
      }}
      {...rest}
      onnavi_control_state={(e) => {
        setConnected(true);
        setDisabled(e.detail.disabled);
        setReadOnly(e.detail.readOnly);
      }}
      onnavi_control_disconnected={() => {
        setConnected(false);
        setDisabled(false);
        setReadOnly(false);
      }}
    >
      {children}
    </Box>
  );
};
