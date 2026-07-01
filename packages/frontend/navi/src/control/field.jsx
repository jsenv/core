import { useContext, useId, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { resolveSpacingSize } from "../box/box_style_util.js";
import { ControlIdContext, MessagePropsRefContext } from "./control_context.js";
import { extractMessageAndRemainingProps } from "./rules/constraint_message.js";

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
      --padding-with-control: var(--navi-xs);

      > [navi-control] + .navi_label {
        padding-left: var(--padding-with-control);
      }
      > .navi_label:first-child {
        padding-right: var(--padding-with-control);
      }
      &[data-vertical] {
        > .navi_label:first-child {
          padding-right: 0;
          padding-bottom: var(--padding-with-control);
        }
        > [navi-control] + .navi_label {
          padding-top: var(--padding-with-control);
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
 * <Field flex paddingWithControl="s">
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
  props.paddingWithControl = resolveSpacingSize(props.paddingWithControl, "s");
  // When used as a label wrapper (implicit association), no htmlFor is needed unless
  // the user explicitly passes one to link to a specific control by id.
  // Pass htmlFor={undefined} explicitly so Label skips auto-generation.
  const htmlFor = Object.hasOwn(props, "htmlFor") ? props.htmlFor : undefined;

  return (
    <Label
      navi-field=""
      styleCSSVars={FieldCSSVars}
      flex={vertical ? "y" : undefined}
      alignX={vertical ? "start" : undefined}
      data-vertical={vertical ? "" : undefined}
      {...props}
      htmlFor={htmlFor}
      vertical={undefined}
    >
      {children}
    </Label>
  );
};
const FieldCSSVars = {
  paddingWithControl: "--padding-with-control",
};
const FieldAsContainer = (props) => {
  import.meta.css = css;
  const { vertical, children } = props;
  props.paddingWithControl = resolveSpacingSize(props.paddingWithControl, "s");
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
  const { children } = props;
  const controlId = useContext(ControlIdContext);
  const [disabled, setDisabled] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [connected, setConnected] = useState(false);
  // Set htmlFor only when we know the correct target id:
  //   - caller explicitly provided one (even undefined to opt out)
  //   - a parent Field provided one via ControlIdContext
  // When neither is present the label either wraps the control directly
  // (implicit HTML association) or is disconnected — either way, a
  // randomly generated id would point to nothing and cause confusion.
  const htmlFor = Object.hasOwn(props, "htmlFor")
    ? props.htmlFor
    : controlId;
  const [messageProps, remainingProps] = extractMessageAndRemainingProps(props);
  const messagePropsRef = useRef();
  messagePropsRef.current = messageProps;

  return (
    <Box
      as="label"
      htmlFor={htmlFor}
      baseClassName="navi_label"
      pseudoClasses={FIELD_PSEUDO_CLASSES}
      data-control-connected={connected ? "" : undefined}
      basePseudoState={{
        ":disabled": disabled,
        ":read-only": readOnly,
      }}
      {...remainingProps}
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
      <MessagePropsRefContext.Provider value={messagePropsRef}>
        <ControlIdContext.Provider value={htmlFor}>
          {children}
        </ControlIdContext.Provider>
      </MessagePropsRefContext.Provider>
    </Box>
  );
};
