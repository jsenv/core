import { InputText, SPADeleteButton, SPAForm } from "@jsenv/router";
import { useState } from "preact/hooks";
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
