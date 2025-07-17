import { DatabaseLink } from "../database/database_link.jsx";

export const RoleDatabaseList = ({ role }) => {
  const databases = role.databases;

  return (
    <div>
      <h2>Databases owned by {role.rolname}</h2>
      {databases.length === 0 ? (
        <span>No databases</span>
      ) : (
        <ul>
          {databases.map((database) => {
            return (
              <li key={database.oid}>
                <DatabaseLink database={database}>
                  {database.datname}
                </DatabaseLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
