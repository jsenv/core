import { connectAs } from "@jsenv/database";
import { ensurePathnameTrailingSlash, urlToExtension, urlIsOrIsInsideOf, asUrlWithoutSearch } from "@jsenv/urls";
import { execSync } from "node:child_process";

function _taggedTemplateLiteral (strings, raw) {
  if (!raw) {
    raw = strings.slice(0);
  }
  return Object.freeze(Object.defineProperties(strings, {
    raw: {
      value: Object.freeze(raw)
    }
  }));
}

var _templateObject$2;
// https://www.postgresql.org/docs/14/sql-alterdatabase.html

const alterDatabaseQuery = async (sql, datname, colname, value) => {
  if (colname === "datdba") {
    await sql(_templateObject$2 || (_templateObject$2 = _taggedTemplateLiteral(["ALTER DATABASE ", " OWNER TO ", ""])), sql(datname), sql(value));
  }
};

var _templateObject$1, _templateObject2$1, _templateObject3$1, _templateObject4$1, _templateObject5$1, _templateObject6$1;
const alterRoleQuery = async (sql, rolname, columnName, value) => {
  if (columnName === "rolname") {
    if (rolname === value) {
      return null;
    }
    return sql(_templateObject$1 || (_templateObject$1 = _taggedTemplateLiteral(["\n      ALTER ROLE ", "\n      RENAME TO ", "\n    "])), sql(rolname), sql(value));
  }
  const keywords = booleanOptionKeywords[columnName];
  if (keywords) {
    return sql(_templateObject2$1 || (_templateObject2$1 = _taggedTemplateLiteral(["\n      ALTER ROLE ", " ", "\n    "])), sql(rolname), sql.unsafe(keywords[value ? 0 : 1]));
  }
  if (columnName === "rolvaliduntil") {
    return sql(_templateObject3$1 || (_templateObject3$1 = _taggedTemplateLiteral(["ALTER ROLE ", " VALID UNTIL '", "'"])), sql(rolname), sql.unsafe(value));
  }
  if (columnName === "rolconnlimit") {
    return sql(_templateObject4$1 || (_templateObject4$1 = _taggedTemplateLiteral(["\n      ALTER ROLE ", " CONNECTION\n      LIMIT\n        ", "\n    "])), sql(rolname), sql.unsafe(value));
  }
  if (columnName === "rolpassword") {
    if (value) {
      return sql(_templateObject5$1 || (_templateObject5$1 = _taggedTemplateLiteral(["ALTER ROLE ", " PASSWORD '", "' "])), sql(rolname), sql.unsafe(value));
    }
    return sql(_templateObject6$1 || (_templateObject6$1 = _taggedTemplateLiteral(["ALTER ROLE ", " PASSWORD NULL"])), sql(rolname));
  }
  return null;
};
const booleanOptionKeywords = {
  rolsuper: ["SUPERUSER", "NOSUPERUSER"],
  rolinherit: ["INHERIT", "NOINHERIT"],
  rolcreaterole: ["CREATEROLE", "NOCREATEROLE"],
  rolcreatedb: ["CREATEDB", "NOCREATEDB"],
  rolcanlogin: ["LOGIN", "NOLOGIN"],
  rolreplication: ["REPLICATION", "NOREPLICATION"],
  rolbypassrls: ["BYPASSRLS", "NOBYPASSRLS"]
};

const alterTableQuery = () => {};

var _templateObject, _templateObject2, _templateObject3, _templateObject4, _templateObject5, _templateObject6, _templateObject7, _templateObject8, _templateObject9, _templateObject0, _templateObject1, _templateObject10, _templateObject11, _templateObject12, _templateObject13, _templateObject14, _templateObject15, _templateObject16, _templateObject17, _templateObject18, _templateObject19, _templateObject20, _templateObject21, _templateObject22, _templateObject23, _templateObject24, _templateObject25, _templateObject26, _templateObject27, _templateObject28, _templateObject29, _templateObject30, _templateObject31, _templateObject32, _templateObject33, _templateObject34, _templateObject35, _templateObject36, _templateObject37, _templateObject38, _templateObject39, _templateObject40, _templateObject41, _templateObject42, _templateObject43;
const databaseManagerHtmlFileUrl = new URL("./html/database_manager.html", import.meta.url).href;
const jsenvPluginDatabaseManager = ({
  pathname = "/.internal/database/"
} = {}) => {
  let databaseManagerRootDirectoryUrl;
  let defaultUsername;
  let sql;
  const getRoleByName = async rolname => {
    const results = await sql(_templateObject || (_templateObject = _taggedTemplateLiteral(["\n      SELECT\n        *\n      FROM\n        pg_roles\n      WHERE\n        rolname = ", "\n    "])), rolname);
    if (results.length === 0) {
      return null;
    }
    const columns = await getTableColumns(sql, "pg_roles");
    const role = results[0];
    //  const privileges = await sql`
    //     SELECT
    //       grantor,
    //       table_schema,
    //       table_name,
    //       privilege_type
    //     FROM
    //       information_schema.table_privileges
    //     WHERE
    //       grantee = ${rolname}
    //   `;
    const objects = await sql(_templateObject2 || (_templateObject2 = _taggedTemplateLiteral(["\n      SELECT\n        pg_class.relname AS object_name,\n        pg_class.relkind AS object_type,\n        pg_namespace.nspname AS schema_name\n      FROM\n        pg_class\n        JOIN pg_roles ON pg_roles.oid = pg_class.relowner\n        LEFT JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid\n      WHERE\n        pg_roles.rolname = ", "\n        AND pg_class.relkind IN ('r', 'v', 'm', 'S', 'f')\n      ORDER BY\n        pg_namespace.nspname,\n        pg_class.relname\n    "])), rolname);
    const databases = await sql(_templateObject3 || (_templateObject3 = _taggedTemplateLiteral(["\n      SELECT\n        pg_database.*\n      FROM\n        pg_database\n        JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n      WHERE\n        pg_roles.rolname = ", "\n    "])), rolname);
    const members = await sql(_templateObject4 || (_templateObject4 = _taggedTemplateLiteral(["\n      SELECT\n        member_role.*,\n        grantor_role.rolname AS grantor_rolname,\n        pg_auth_members.admin_option\n      FROM\n        pg_auth_members\n        JOIN pg_roles AS parent_role ON pg_auth_members.roleid = parent_role.oid\n        JOIN pg_roles AS member_role ON pg_auth_members.member = member_role.oid\n        LEFT JOIN pg_roles AS grantor_role ON pg_auth_members.grantor = grantor_role.oid\n      WHERE\n        parent_role.rolname = ", "\n    "])), rolname);
    return {
      role,
      objects,
      databases,
      members,
      columns
    };
  };
  return {
    name: "jsenv:database_manager",
    init: async ({
      rootDirectoryUrl
    }) => {
      defaultUsername = execSync("whoami").toString().trim();
      sql = connectAs({
        username: defaultUsername,
        password: "",
        database: "postgres"
      });
      databaseManagerRootDirectoryUrl = new URL(pathname.slice(1), rootDirectoryUrl).href;
    },
    transformUrlContent: {
      html: async urlInfo => {
        const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url);
        if (urlWithoutSearch !== String(databaseManagerHtmlFileUrl)) {
          return null;
        }

        // we might want to use any available cookie used to auth
        const currentRoleResult = await sql(_templateObject5 || (_templateObject5 = _taggedTemplateLiteral(["\n          SELECT\n            current_user\n        "])));
        const currentRoleName = currentRoleResult[0].current_user;
        const [currentRole] = await sql(_templateObject6 || (_templateObject6 = _taggedTemplateLiteral(["\n          SELECT\n            *\n          FROM\n            pg_roles\n          WHERE\n            rolname = ", "\n        "])), currentRoleName);
        const [currentDatabase] = await sql(_templateObject7 || (_templateObject7 = _taggedTemplateLiteral(["\n          SELECT\n            *\n          FROM\n            pg_database\n          WHERE\n            datname = current_database()\n        "])));
        return {
          contentInjections: {
            __DB_MANAGER_CONFIG__: {
              pathname,
              apiUrl: new URL("".concat(pathname, "api"), urlInfo.context.request.origin).href,
              currentRole,
              currentDatabase
            }
          }
        };
      }
    },
    redirectReference: reference => {
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      const urlWithTrailingSlash = ensurePathnameTrailingSlash(reference.url);
      if (!urlToExtension(reference.url) && urlIsOrIsInsideOf(urlWithTrailingSlash, databaseManagerRootDirectoryUrl)) {
        return databaseManagerHtmlFileUrl;
      }
      return null;
    },
    devServerRoutes: [{
      endpoint: "GET ".concat(pathname),
      description: "Manage database using a Web interface",
      declarationSource: import.meta.url,
      fetch: () => {
        // is done by redirectReference
        return null;
      }
    }, {
      endpoint: "GET ".concat(pathname, "api/explorer"),
      description: "Get info about the database manager explorer.",
      declarationSource: import.meta.url,
      fetch: async () => {
        const databaseCount = await countRows(sql, "pg_database");
        const tableCount = await countRows(sql, "pg_tables");
        const roleCounts = await countRoles(sql);
        return Response.json({
          data: {
            databaseCount,
            tableCount,
            roleCounts
          }
        });
      }
    }, ...createRESTRoutes("".concat(pathname, "api/tables"), {
      "GET": async request => {
        const publicFilter = request.searchParams.has("public");
        const data = await sql(_templateObject8 || (_templateObject8 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_tables\n            WHERE\n              ", "\n          "])), publicFilter ? sql(_templateObject9 || (_templateObject9 = _taggedTemplateLiteral(["schemaname = 'public'"]))) : sql(_templateObject0 || (_templateObject0 = _taggedTemplateLiteral(["schemaname NOT IN ('pg_catalog', 'information_schema')"]))));
        const columns = await getTableColumns(sql, "pg_tables");
        return {
          data,
          meta: {
            columns
          }
        };
      },
      "POST": async request => {
        const {
          tablename
        } = await request.json();
        await sql(_templateObject1 || (_templateObject1 = _taggedTemplateLiteral(["CREATE TABLE ", ""])), sql(tablename));
        const [table] = await sql(_templateObject10 || (_templateObject10 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_tables\n            WHERE\n              tablename = ", "\n          "])), tablename);
        return {
          data: table,
          meta: {
            roleCounts: await countRoles(sql)
          }
        };
      },
      "GET /:tablename": async request => {
        const {
          tablename
        } = request.params;
        const results = await sql(_templateObject11 || (_templateObject11 = _taggedTemplateLiteral(["\n            SELECT\n              pg_tables.*,\n              role.rolname AS owner_rolname,\n              role.oid AS owner_oid\n            FROM\n              pg_tables\n              LEFT JOIN pg_roles role ON pg_tables.tableowner = role.rolname\n            WHERE\n              pg_tables.tablename = ", "\n          "])), tablename);
        if (results.length === 0) {
          return null;
        }
        const columns = await getTableColumns(sql, "pg_tables");
        const [table] = results;
        const ownerRole = table.owner_oid ? {
          oid: table.owner_oid,
          rolname: table.owner_rolname
        } : null;
        delete table.owner_rolname;
        delete table.owner_oid;
        return {
          data: table,
          meta: {
            ownerRole,
            columns
          }
        };
      },
      "PUT /:tablename/:colname": async request => {
        const {
          tablename,
          colname
        } = request.params;
        const value = await request.json();
        await alterTableQuery();
        return {
          [colname]: value
        };
      },
      "DELETE /:tablename": async request => {
        const {
          tablename
        } = request.params;
        await sql(_templateObject12 || (_templateObject12 = _taggedTemplateLiteral(["DROP TABLE ", ""])), sql(tablename));
        return {
          data: null,
          meta: {
            count: await countRows(sql, "pg_tables")
          }
        };
      }
    }), ...createRESTRoutes("".concat(pathname, "api/roles"), {
      "GET": async request => {
        const canLogin = request.searchParams.get("can_login");
        let whereClause = "";
        if (canLogin !== null) {
          const canLoginValue = canLogin.toLowerCase();
          if (canLoginValue === "" || canLoginValue === "1" || canLoginValue === "true") {
            whereClause = sql(_templateObject13 || (_templateObject13 = _taggedTemplateLiteral(["\n                WHERE\n                  pg_roles.rolcanlogin = TRUE\n              "])));
          } else if (canLoginValue === "0" || canLoginValue === "false") {
            whereClause = sql(_templateObject14 || (_templateObject14 = _taggedTemplateLiteral(["\n                WHERE\n                  pg_roles.rolcanlogin = FALSE\n              "])));
          }
        }
        const ownersFlag = request.searchParams.has("owners");
        const roles = await sql(_templateObject15 || (_templateObject15 = _taggedTemplateLiteral(["\n            SELECT\n              pg_roles.*,\n              COALESCE(table_count_result.table_count, 0) AS table_count,\n              COALESCE(database_count_result.database_count, 0) AS database_count\n            FROM\n              pg_roles\n              LEFT JOIN (\n                SELECT\n                  tableowner,\n                  COUNT(*) AS table_count\n                FROM\n                  pg_tables\n                WHERE\n                  schemaname NOT IN ('pg_catalog', 'information_schema')\n                GROUP BY\n                  tableowner\n              ) table_count_result ON pg_roles.rolname = table_count_result.tableowner\n              LEFT JOIN (\n                SELECT\n                  pg_roles.rolname AS database_owner,\n                  COUNT(*) AS database_count\n                FROM\n                  pg_database\n                  JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n                GROUP BY\n                  pg_roles.rolname\n              ) database_count_result ON pg_roles.rolname = database_count_result.database_owner ", "\n          "])), whereClause || sql(_templateObject16 || (_templateObject16 = _taggedTemplateLiteral([""]))));
        for (const role of roles) {
          role.table_count = parseInt(role.table_count) || 0;
          role.database_count = parseInt(role.database_count) || 0;
          role.object_count = role.table_count + role.database_count;
        }
        const currentRoleResult = await sql(_templateObject17 || (_templateObject17 = _taggedTemplateLiteral(["\n            SELECT\n              current_user\n          "])));
        const currentRoleName = currentRoleResult[0].current_user;
        const [currentRole] = await sql(_templateObject18 || (_templateObject18 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), currentRoleName);
        if (ownersFlag) {
          const owners = [];
          for (const role of roles) {
            if (role.object_count > 0) {
              owners.push(role);
            }
          }
          return {
            data: owners,
            meta: {
              currentRole
            }
          };
        }
        return {
          data: roles,
          meta: {
            currentRole
          }
        };
      },
      "POST": async request => {
        const {
          rolname,
          rolcanlogin
        } = await request.json();
        // https://www.postgresql.org/docs/current/sql-createrole.html
        if (rolcanlogin) {
          await sql(_templateObject19 || (_templateObject19 = _taggedTemplateLiteral(["CREATE ROLE ", " LOGIN"])), sql(rolname));
        } else {
          await sql(_templateObject20 || (_templateObject20 = _taggedTemplateLiteral(["CREATE ROLE ", ""])), sql(rolname));
        }
        const [role] = await sql(_templateObject21 || (_templateObject21 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), rolname);
        return {
          data: role,
          meta: {
            roleCounts: await countRoles(sql)
          }
        };
      },
      "GET /:rolname": async request => {
        const {
          rolname
        } = request.params;
        const result = await getRoleByName(rolname);
        if (!result) {
          return null;
        }
        const {
          role,
          ...meta
        } = result;
        return {
          data: role,
          meta
        };
      },
      "PUT /:rolname/:colname": async request => {
        const {
          rolname,
          colname
        } = request.params;
        const value = await request.json();
        await alterRoleQuery(sql, rolname, colname, value);
        return {
          [colname]: value
        };
      },
      // when dropping roles, consider this: https://neon.tech/postgresql/postgresql-administration/postgresql-drop-role
      "DELETE /:rolname": async request => {
        const {
          rolname
        } = request.params;
        await sql(_templateObject22 || (_templateObject22 = _taggedTemplateLiteral(["DROP ROLE ", ""])), sql(rolname));
        return {
          data: null,
          meta: {
            roleCounts: await countRoles(sql)
          }
        };
      },
      "GET /:rolname/tables": async request => {
        const {
          rolname
        } = request.params;
        const tables = await sql(_templateObject23 || (_templateObject23 = _taggedTemplateLiteral(["\n            SELECT\n              pg_tables.*\n            FROM\n              pg_tables\n              JOIN pg_roles ON pg_roles.rolname = pg_tables.tableowner\n            WHERE\n              pg_roles.rolname = ", "\n              AND pg_tables.schemaname NOT IN ('pg_catalog', 'information_schema')\n          "])), rolname);
        if (tables.length === 0) {
          return {
            data: []
          };
        }
        return {
          data: tables,
          meta: {}
        };
      },
      "GET /:rolname/databases": async request => {
        const {
          rolname
        } = request.params;
        const databases = await sql(_templateObject24 || (_templateObject24 = _taggedTemplateLiteral(["\n            SELECT\n              pg_database.*\n            FROM\n              pg_database\n              JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n            WHERE\n              pg_roles.rolname = ", "\n          "])), rolname);
        if (databases.length === 0) {
          return {
            data: []
          };
        }
        return {
          data: databases,
          meta: {}
        };
      },
      "PUT /:rolname/members/:memberRolname": async request => {
        const {
          rolname,
          memberRolname
        } = request.params;
        await sql(_templateObject25 || (_templateObject25 = _taggedTemplateLiteral(["GRANT ", " TO ", ""])), sql(rolname), sql(memberRolname));
        const [memberRole] = await sql(_templateObject26 || (_templateObject26 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), memberRolname);
        return {
          data: memberRole
        };
      },
      "DELETE /:rolname/members/:memberRolname": async request => {
        const {
          rolname,
          memberRolname
        } = request.params;
        await sql(_templateObject27 || (_templateObject27 = _taggedTemplateLiteral(["\n            REVOKE ", "\n            FROM\n              ", "\n          "])), sql(rolname), sql(memberRolname));
        return {
          data: null
        };
      }
    }), ...createRESTRoutes("".concat(pathname, "api/databases"), {
      "GET": async () => {
        const [currentDatabaseResult] = await sql(_templateObject28 || (_templateObject28 = _taggedTemplateLiteral(["\n            SELECT\n              current_database()\n          "])));
        const currentDatname = currentDatabaseResult.current_database;
        const [currentDatabase] = await sql(_templateObject29 || (_templateObject29 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n            WHERE\n              datname = ", "\n          "])), currentDatname);
        const databases = await sql(_templateObject30 || (_templateObject30 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n          "])));
        const countTables = async database => {
          if (database === currentDatname) {
            return countRows(sql, "pg_tables");
          }
          const sqlConnectedToThatDb = connectAs({
            username: defaultUsername,
            password: "",
            database
          });
          const count = await countRows(sqlConnectedToThatDb, "pg_tables");
          sqlConnectedToThatDb.end();
          return count;
        };
        const tableCounts = {};
        const promises = [];
        for (const database of databases) {
          if (!database.datallowconn) {
            continue;
          }
          const countPromise = countTables(database.datname);
          promises.push(countPromise);
          (async () => {
            const count = await countPromise;
            tableCounts[database.datname] = count;
          })();
        }
        await Promise.all(promises);
        return {
          data: databases,
          meta: {
            currentDatabase,
            tableCounts
          }
        };
      },
      "POST": async request => {
        const {
          datname
        } = await request.json();
        await sql(_templateObject31 || (_templateObject31 = _taggedTemplateLiteral(["CREATE DATABASE ", ""])), sql(datname));
        const [database] = await sql(_templateObject32 || (_templateObject32 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n            WHERE\n              datname = ", "\n          "])), datname);
        return {
          data: database,
          meta: {
            count: await countRows(sql, "pg_database")
          }
        };
      },
      "GET /:datname": async request => {
        const {
          datname
        } = request.params;
        const results = await sql(_templateObject33 || (_templateObject33 = _taggedTemplateLiteral(["\n            SELECT\n              pg_database.*,\n              role.rolname AS owner_rolname,\n              role.oid AS owner_oid\n            FROM\n              pg_database\n              LEFT JOIN pg_roles role ON role.oid = pg_database.datdba\n            WHERE\n              pg_database.datname = ", "\n          "])), datname);
        if (results.length === 0) {
          return null;
        }
        const columns = await getTableColumns(sql, "pg_database");
        const [database] = results;
        const ownerRole = database.owner_oid ? {
          oid: database.owner_oid,
          rolname: database.owner_rolname
        } : null;
        delete database.owner_rolname;
        delete database.owner_oid;
        return {
          data: database,
          meta: {
            ownerRole,
            columns
          }
        };
      },
      "PUT /:datname/:colname": async request => {
        const {
          datname,
          colname
        } = request.params;
        const value = await request.json();
        await alterDatabaseQuery(sql, datname, colname, value);
        return {
          [colname]: value
        };
      },
      "DELETE /:datname": async request => {
        const {
          datname
        } = request.params;
        await sql(_templateObject34 || (_templateObject34 = _taggedTemplateLiteral(["DROP DATABASE ", ""])), sql(datname));
        return {
          data: null,
          meta: {
            count: await countRows(sql, "pg_database")
          }
        };
      }
    }), {
      endpoint: "PUT ".concat(pathname, "/api/tables/:tableName/columns/name"),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const tableName = request.params.tableName;
        const tableNewName = await request.json();
        await sql(_templateObject35 || (_templateObject35 = _taggedTemplateLiteral(["\n            ALTER TABLE ", "\n            RENAME TO ", ";\n          "])), sql(tableName), sql(tableNewName));
        return Response.json({
          name: tableNewName
        });
      }
    }, {
      endpoint: "PUT ".concat(pathname, "/api/tables/:tableName/columns/rowsecurity"),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const tableName = request.params.tableName;
        const value = await request.json();
        if (value === "on") {
          await sql(_templateObject36 || (_templateObject36 = _taggedTemplateLiteral(["\n              ALTER TABLE ", " ENABLE ROW LEVEL SECURITY;\n            "])), sql(tableName));
        } else {
          await sql(_templateObject37 || (_templateObject37 = _taggedTemplateLiteral(["\n              ALTER TABLE ", " DISABLE ROW LEVEL SECURITY;\n            "])), sql(tableName));
        }
        return Response.json({
          rowsecurity: value === "on"
        });
      }
    }, {
      endpoint: "PUT ".concat(pathname, "/api/tables/:tableName/columns/:columnName/rows/:rowId"),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async () => {
        // const tableName = request.params.tableName;
        // const columnName = request.params.columnName;
        // const rowId = request.params.rowId;
      }
    },
    // https://wiki.postgresql.org/wiki/Alter_column_position#Add_columns_and_move_data
    {
      endpoint: "PUT ".concat(pathname, "/api/tables/:name/columns/:columnName/move_before"),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const tableName = request.params.name;
        const columnName = request.params.columnName;
        const beforeColumnName = await request.json();
        if (columnName === beforeColumnName) {
          return Response.json("Column and before column are the same :".concat(columnName), {
            status: 400
          });
        }
        const columns = await sql(_templateObject38 || (_templateObject38 = _taggedTemplateLiteral(["\n            SELECT\n              ordinal_position,\n              data_type\n            FROM\n              information_schema.columns\n            WHERE\n              table_name = ", "\n              AND column_name = ", "\n          "])), sql(tableName), sql(columnName));
        let columnIndex;
        let beforeColumnIndex;
        {
          let index;
          while (index < columns.length) {
            const columnCandidate = columns[index];
            if (columnCandidate.column_name === columnName) {
              columnIndex = index;
              if (beforeColumnIndex === undefined) {
                continue;
              }
              break;
            }
            if (columnCandidate.column_name === beforeColumnName) {
              beforeColumnIndex = index;
              if (columnIndex === undefined) {
                continue;
              }
              break;
            }
          }
        }
        if (columnIndex === undefined) {
          return Response.json({
            message: "Column ".concat(columnName, " not found in table ").concat(tableName)
          }, {
            status: 404
          });
        }
        if (beforeColumnIndex === undefined) {
          return Response.json({
            message: "Column ".concat(beforeColumnName, " not found in table ").concat(tableName)
          }, {
            status: 404
          });
        }
        if (beforeColumnIndex === columnIndex - 1) {
          return Response.json("", {
            status: 204
          });
        }
        const addInstructions = [];
        const setInstructions = [];
        const removeInstructions = [];
        const renameInstructions = [];
        /**
         *  - a|b|c
         *  - I want to move b before a
         *  1. COPY a = a_temp and c=c_temp
         *  -> a|b|c|a_temp|c_temp
         *  3. REMOVE a and c
         *  -> b|a_temp|c_temp
         *  4. RENAME a_temp to a and c_temp to c
         *  -> b|a|c
         */
        {
          {
            let indexBefore = beforeColumnIndex;
            while (indexBefore--) {
              const columnBefore = columns[indexBefore];
              addInstructions.push("ADD COLUMN ".concat(sql(columnBefore.column_name), "_temp ").concat(sql(columnBefore.data_type)));
              setInstructions.push("".concat(sql(columnBefore.column_name), "_temp = ").concat(sql(columnBefore.column_name)));
              removeInstructions.push("DROP COLUMN ".concat(sql(columnBefore.column_name), " cascade"));
              renameInstructions.push("ALTER TABLE ".concat(sql(tableName), " RENAME COLUMN ").concat(sql(columnBefore.column_name), "_temp TO ").concat(sql(columnBefore.column_name)));
            }
          }
          {
            let indexAfter = columnIndex + 1;
            while (indexAfter < columns.length) {
              const columnAfter = columns[indexAfter];
              addInstructions.push("ADD COLUMN ".concat(sql(columnAfter.column_name), "_temp ").concat(sql(columnAfter.data_type)));
              setInstructions.push("".concat(sql(columnAfter.column_name), "_temp = ").concat(sql(columnAfter.column_name)));
              removeInstructions.push("DROP COLUMN ".concat(sql(columnAfter.column_name), " cascade"));
              renameInstructions.push("ALTER TABLE ".concat(sql(tableName), " RENAME COLUMN ").concat(sql(columnAfter.column_name), "_temp TO ").concat(sql(columnAfter.column_name)));
              indexAfter++;
            }
          }
        }
        let query = "";
        {
          query += "\n";
          query += "# add new columns";
          query += "\n";
          query = "ALTER TABLE ".concat(sql(tableName), " ");
          query += addInstructions.join(", ");
          query += ";";
          {
            query += "\n";
            query += "# update new columns";
            query += "\n";
            query += "ALTER TABLE ".concat(sql(tableName));
            query += " SET";
            query += setInstructions.join(", ");
            query += ";";
          }
        }
        {
          query += "\n";
          query += "# remove old columns";
          query += "\n";
          query += "ALTER TABLE ".concat(sql(tableName), " ");
          query += removeInstructions.join(", ");
          query += ";";
        }
        {
          query += "\n";
          query += "# rename new columns";
          query += "\n";
          query += renameInstructions.join("\n");
          query += "\n";
        }
        // here we want to check how the query look like
        debugger;
        await sql.unsafe(query);
        return Response.json(null, {
          status: 204
        });
      }
    }],
    devServerServices: [{
      name: "postgres_sql_error_handler",
      handleError: e => {
        if (!e || e.name !== "PostgresError") {
          return null;
        }
        let message = e.message;
        if (e.detail) {
          message += " (".concat(e.detail, ")");
        }
        const errorData = {
          ...e,
          message
        };
        if (e.code === "2BP01" || e.code === "42710") {
          return Response.json(errorData, {
            status: 409,
            statusText: message.replace(/\n/g, "")
          });
        }
        if (e.code === "42704") {
          return Response.json(errorData, {
            status: 404,
            statusText: message
          });
        }
        return Response.json(errorData, {
          status: 500,
          statusText: message
        });
      }
    }]
  };
};
const createRESTRoutes = (resource, endpoints) => {
  const routes = [];
  const onRoute = ({
    method,
    subpath
  }, handler) => {
    const endpointResource = subpath ? "".concat(resource).concat(subpath) : resource;
    if (method === "GET") {
      const getRoute = {
        endpoint: "GET ".concat(endpointResource),
        declarationSource: import.meta.url,
        fetch: async request => {
          const body = await handler(request);
          if (!body) {
            const paramKeys = Object.keys(request.params);
            if (paramKeys.length) {
              const identifier = request.params[paramKeys[0]];
              return Response.json({
                message: "".concat(endpointResource, " \"").concat(identifier, "\" not found")
              }, {
                status: 404
              });
            }
            return Response.json({
              message: "".concat(endpointResource, " not found")
            }, {
              status: 404
            });
          }
          return Response.json(body);
        }
      };
      routes.push(getRoute);
      return;
    }
    if (method === "POST") {
      const postRoute = {
        endpoint: "POST ".concat(endpointResource),
        declarationSource: import.meta.url,
        acceptedMediaTypes: ["application/json"],
        fetch: async request => {
          const body = await handler(request);
          return Response.json(body, {
            status: 201
          });
        }
      };
      routes.push(postRoute);
      return;
    }
    if (method === "PUT") {
      const putRoute = {
        endpoint: "PUT ".concat(endpointResource),
        declarationSource: import.meta.url,
        fetch: async request => {
          const body = await handler(request);
          return Response.json(body);
        }
      };
      routes.push(putRoute);
      return;
    }
    if (method === "DELETE") {
      const deleteRoute = {
        endpoint: "DELETE ".concat(endpointResource),
        declarationSource: import.meta.url,
        fetch: async request => {
          const body = await handler(request);
          return body === null || body === undefined ? new Response(null, {
            status: 204
          }) : Response.json(body);
        }
      };
      routes.push(deleteRoute);
      return;
    }
  };
  for (const key of Object.keys(endpoints)) {
    if (key.includes(" ")) {
      const [method, subpath] = key.split(" ");
      onRoute({
        method,
        subpath
      }, endpoints[key]);
    } else {
      onRoute({
        method: key
      }, endpoints[key]);
    }
  }
  return routes;
};
const countRoles = async sql => {
  const [roleStats] = await sql(_templateObject39 || (_templateObject39 = _taggedTemplateLiteral(["\n    SELECT\n      COUNT(*) AS total_roles,\n      COUNT(\n        CASE\n          WHEN rolcanlogin = TRUE THEN 1\n        END\n      ) AS can_login_count,\n      COUNT(\n        CASE\n          WHEN rolcanlogin = FALSE THEN 1\n        END\n      ) AS group_count,\n      COUNT(\n        CASE\n          WHEN (\n            table_owners.tableowner IS NOT NULL\n            OR database_owners.database_owner IS NOT NULL\n          ) THEN 1\n        END\n      ) AS with_ownership_count\n    FROM\n      pg_roles\n      LEFT JOIN (\n        SELECT DISTINCT\n          tableowner\n        FROM\n          pg_tables\n        WHERE\n          schemaname NOT IN ('pg_catalog', 'information_schema')\n      ) table_owners ON pg_roles.rolname = table_owners.tableowner\n      LEFT JOIN (\n        SELECT DISTINCT\n          pg_roles.rolname AS database_owner\n        FROM\n          pg_database\n          JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n      ) database_owners ON pg_roles.rolname = database_owners.database_owner\n  "])));
  const {
    total_roles,
    can_login_count,
    group_count,
    with_ownership_count
  } = roleStats;
  return {
    total: parseInt(total_roles),
    canLoginCount: parseInt(can_login_count),
    groupCount: parseInt(group_count),
    withOwnershipCount: parseInt(with_ownership_count)
  };
};
const countRows = async (sql, tableName, {
  whereClause
} = {}) => {
  if (tableName === "pg_tables") {
    const [tableCountResult] = await sql(_templateObject40 || (_templateObject40 = _taggedTemplateLiteral(["\n      SELECT\n        COUNT(*)\n      FROM\n        pg_tables\n      WHERE\n        schemaname NOT IN ('pg_catalog', 'information_schema')\n    "])));
    return parseInt(tableCountResult.count);
  }
  const [countResult] = await sql(_templateObject41 || (_templateObject41 = _taggedTemplateLiteral(["\n    SELECT\n      COUNT(*)\n    FROM\n      ", " ", "\n  "])), sql(tableName), whereClause || sql(_templateObject42 || (_templateObject42 = _taggedTemplateLiteral([""]))));
  return parseInt(countResult.count);
};
const getTableColumns = async (sql, tableName) => {
  const columns = await sql(_templateObject43 || (_templateObject43 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      information_schema.columns\n    WHERE\n      table_name = ", "\n  "])), tableName);
  return columns;
};

export { jsenvPluginDatabaseManager };
