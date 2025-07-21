import { Button, Form, Input, useNavState } from "@jsenv/navi";
import { useState } from "preact/hooks";
import { ROLE_MEMBERS } from "../../store.js";
import { RoleLink } from "../role_link.jsx";

export const RoleGroupMemberList = ({ role }) => {
  const memberList = role.members;

  const [navState] = useNavState(`group_member_list_opened`);
  const [isAdding, isAddingSetter] = useState(navState);

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
          <Form
            action={ROLE_MEMBERS.POST.bindParams({
              rolname: role.rolname,
            })}
            errorTarget="input"
          >
            <label>
              <span>Role name: </span>
              <Input
                type="text"
                id="membername"
                name="membername"
                autoFocus
                placeholder="Role name"
              />
            </label>

            <Button type="submit">Submit</Button>
          </Form>
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
                <Button
                  action={ROLE_MEMBERS.DELETE.bindParams({
                    rolname: role.rolname,
                    memberRolname: memberRole.rolname,
                  })}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
