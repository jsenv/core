import { useContext } from "preact/hooks";

import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import { EmailSvg } from "@jsenv/navi/src/graphic/icons/email_svg.jsx";
import { PhoneSvg } from "@jsenv/navi/src/graphic/icons/phone_svg.jsx";
import { SearchSvg } from "@jsenv/navi/src/graphic/icons/search_svg.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { triggerStringAction } from "../string_actions.js";
import { dispatchRequestInteraction } from "../validation/custom_constraint_validation.js";
import { InputTextualContext } from "./input_textual_context.js";
import { InputIconSlot, InputRightSlot } from "./input_ui_components.jsx";

export const InputTypeResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "search") {
    return <InputSearch {...props} />;
  }
  if (props.type === "email") {
    return <InputEmail {...props} />;
  }
  if (props.type === "tel") {
    return <InputTel {...props} />;
  }
  if (props.type === "number") {
    return <InputNumber {...props} />;
  }
  if (props.type === "color") {
    return <InputColor {...props} />;
  }
  if (props.type === "datetime-local") {
    return <InputDatetimeLocal {...props} />;
  }
  return <Next {...props} />;
};

const InputSearch = (props) => {
  const Next = useNextResolver();

  return <Next ui={<InputSearchUI icon={props.icon} />} {...props} />;
};
const InputSearchUI = ({ icon }) => {
  const ctx = useContext(InputTextualContext);
  const { id } = ctx;

  return (
    <>
      {icon === undefined && (
        <InputIconSlot>
          <SearchSvg />
        </InputIconSlot>
      )}
      <InputRightSlot
        hideWhileEmpty
        action-target={id}
        onClick={(e) => {
          const input = e.currentTarget;
          const allowed = dispatchRequestInteraction(input, e);
          if (allowed) {
            triggerStringAction("clear", e, { skipClose: true });
          }
        }}
      >
        <Icon>
          <CloseSvg />
        </Icon>
      </InputRightSlot>
    </>
  );
};
const InputEmail = (props) => {
  const Next = useNextResolver();

  return <Next ui={<InputEmailUI />} {...props} />;
};
const InputEmailUI = ({ icon }) => {
  if (icon !== undefined) {
    return null;
  }
  return (
    <InputIconSlot>
      <EmailSvg />
    </InputIconSlot>
  );
};
const InputTel = (props) => {
  const Next = useNextResolver();
  return <Next ui={<InputTelUI icon={props.icon} />} {...props} />;
};
const InputTelUI = ({ icon }) => {
  if (icon !== undefined) {
    return null;
  }
  return (
    <InputIconSlot>
      <PhoneSvg />
    </InputIconSlot>
  );
};
const InputNumber = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};
const InputColor = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};
const InputDatetimeLocal = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};
