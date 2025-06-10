import {
  useInputCustomValidationRef,
  useInputValidationMessage,
} from "@jsenv/form";
import { SPADeleteButton, SPAForm, useSPAFormStatus } from "@jsenv/router";
import { forwardRef } from "preact/compat";
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { RoleLink } from "../role_link.jsx";
import { ADD_MEMBER_ACTION, REMOVE_MEMBER_ACTION } from "../role_routes.js";
import { useRoleMemberList } from "../role_signals.js";

export const RoleGroupMemberList = ({ role }) => {
  const memberList = useRoleMemberList(role);
  const [isAdding, isAddingSetter] = useState(false);

  return (
    <div>
      <h2 style="gap: 10px; display: flex; align-items: center;">
        <span>Members of this group</span>
        <div className="actions">
          <button
            onClick={() => {
              isAddingSetter((prev) => !prev);
            }}
          >
            {isAdding ? "Cancel" : "Add"}
          </button>
        </div>
      </h2>
      {isAdding && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "lightgrey",
            padding: "10px",
          }}
        >
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              margin: "0px",
              gap: "10px",
            }}
          >
            Adding member
          </h3>
          <SPAForm
            action={ADD_MEMBER_ACTION.bindParams({
              rolname: role.rolname,
            })}
            errorTarget="input"
          >
            <label>
              <span>Role name: </span>
              <InputText name="membername" autoFocus placeholder="Role name" />
            </label>

            <SPAForm.Button>Submit</SPAForm.Button>
          </SPAForm>
        </div>
      )}
      {memberList.length === 0 ? (
        <span>No members</span>
      ) : (
        <ul>
          {memberList.map((memberRole) => {
            return (
              <li key={memberRole.oid} style="display: flex; gap: 10px;">
                <RoleLink role={memberRole}>{memberRole.rolname}</RoleLink>
                <SPADeleteButton
                  action={REMOVE_MEMBER_ACTION.bindParams({
                    rolname: role.rolname,
                    memberRolname: memberRole.rolname,
                  })}
                >
                  Remove
                </SPADeleteButton>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const InputText = forwardRef(
  ({ autoFocus, autoSelect, constraints = [], disabled, ...rest }, ref) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);

    const [addFormErrorOnInput, removeFormErrorFromInput] =
      useInputValidationMessage(innerRef, "form_error");
    const { pending, error } = useSPAFormStatus();
    useEffect(() => {
      if (pending) {
        removeFormErrorFromInput();
      }
    }, [pending]);

    useEffect(() => {
      if (error) {
        addFormErrorOnInput(error);
      }
    }, [error]);

    // autoFocus does not work so we focus in a useLayoutEffect,
    // see https://github.com/preactjs/preact/issues/1255
    useLayoutEffect(() => {
      if (!autoFocus) {
        return null;
      }
      const activeElement = document.activeElement;
      const input = innerRef.current;
      input.focus();
      if (autoSelect) {
        input.select();
      }
      return () => {
        if (
          document.activeElement === input ||
          document.activeElement === document.body
        ) {
          // if the input is focused when the component is unmounted,
          // we restore focus to the element that was focused before
          // the input was focused
          if (document.body.contains(activeElement)) {
            activeElement.focus();
          }
        }
      };
    }, [autoFocus]);
    useEffect(() => {
      if (autoFocus) {
        const input = innerRef.current;
        input.scrollIntoView({ inline: "nearest", block: "nearest" });
      }
    }, []);

    const inputCustomValidationRef = useInputCustomValidationRef(innerRef);
    useLayoutEffect(() => {
      const inputCustomValidation = inputCustomValidationRef.current;
      const cleanupCallbackSet = new Set();
      for (const constraint of constraints) {
        const unregister = inputCustomValidation.registerConstraint(constraint);
        cleanupCallbackSet.add(unregister);
      }
      return () => {
        for (const cleanupCallback of cleanupCallbackSet) {
          cleanupCallback();
        }
      };
    }, constraints);

    return (
      <input
        {...rest}
        ref={innerRef}
        disabled={pending || disabled}
        type="text"
      ></input>
    );
  },
);
