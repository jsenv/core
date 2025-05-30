import { readParamsFromContext, connectAs } from "@jsenv/database";
import { ensurePathnameTrailingSlash, urlToExtension, urlIsOrIsInsideOf } from "@jsenv/urls";

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

// https://www.postgresql.org/docs/14/sql-alterdatabase.html

const alterDatabaseQuery = () => {};

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

var _templateObject, _templateObject2, _templateObject3, _templateObject4, _templateObject5, _templateObject6, _templateObject7, _templateObject8, _templateObject9, _templateObject0, _templateObject1, _templateObject10, _templateObject11, _templateObject12, _templateObject13, _templateObject14, _templateObject15, _templateObject16, _templateObject17, _templateObject18, _templateObject19, _templateObject20, _templateObject21, _templateObject22;
const databaseManagerHtmlFileUrl = new URL("./html/database_manager.html", import.meta.url).href;
const jsenvPluginDatabaseManager = () => {
  let databaseManagerRootDirectoryUrl;
  let sql;
  return {
    name: "jsenv:database_manager",
    init: async ({
      rootDirectoryUrl
    }) => {
      const {
        defaultUsername,
        database
      } = readParamsFromContext();
      sql = connectAs({
        username: defaultUsername,
        password: "",
        database
      });
      databaseManagerRootDirectoryUrl = new URL("./.internal/database/", rootDirectoryUrl).href;
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
      endpoint: "GET /.internal/database",
      description: "Manage database using a Web interface",
      declarationSource: import.meta.url,
      fetch: () => {
        // is done by redirectReference
        return null;
      }
    }, {
      endpoint: "GET /.internal/database/api/nav",
      description: "Get info about the database that can be used to build a navbar",
      declarationSource: import.meta.url,
      fetch: async () => {
        const currentRoleResult = await sql(_templateObject || (_templateObject = _taggedTemplateLiteral(["\n            SELECT\n              current_user\n          "])));
        const currentRoleName = currentRoleResult[0].current_user;
        const [currentRole] = await sql(_templateObject2 || (_templateObject2 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), currentRoleName);
        const roles = await sql(_templateObject3 || (_templateObject3 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n          "])));
        const [currentDatabaseResult] = await sql(_templateObject4 || (_templateObject4 = _taggedTemplateLiteral(["\n            SELECT\n              current_database()\n          "])));
        const currentDatname = currentDatabaseResult.current_database;
        const [currentDatabase] = await sql(_templateObject5 || (_templateObject5 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n            WHERE\n              datname = ", "\n          "])), currentDatname);
        const databases = await sql(_templateObject6 || (_templateObject6 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n          "])));
        return Response.json({
          currentRole,
          currentDatabase,
          roles,
          databases
        });
      }
    }, ...createRESTRoutes("roles", {
      GET: async rolname => {
        const results = await sql(_templateObject7 || (_templateObject7 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), rolname);
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
        const objects = await sql(_templateObject8 || (_templateObject8 = _taggedTemplateLiteral(["\n            SELECT\n              pg_class.relname AS object_name,\n              pg_class.relkind AS object_type,\n              pg_namespace.nspname AS schema_name\n            FROM\n              pg_class\n              JOIN pg_roles ON pg_roles.oid = pg_class.relowner\n              LEFT JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid\n            WHERE\n              pg_roles.rolname = ", "\n              AND pg_class.relkind IN ('r', 'v', 'm', 'S', 'f')\n            ORDER BY\n              pg_namespace.nspname,\n              pg_class.relname\n          "])), rolname);
        const databases = await sql(_templateObject9 || (_templateObject9 = _taggedTemplateLiteral(["\n            SELECT\n              pg_database.*\n            FROM\n              pg_database\n              JOIN pg_roles ON pg_roles.oid = pg_database.datdba\n            WHERE\n              pg_roles.rolname = ", "\n          "])), rolname);
        return {
          role,
          databases,
          objects,
          // privileges,
          columns
        };
      },
      PUT: async (rolname, colname, value) => {
        await alterRoleQuery(sql, rolname, colname, value);
      },
      POST: async ({
        rolname
      }) => {
        // ideally we would support more options like
        // const { rolname, ...options} = role and pass them to the sql query
        // as documented in https://www.postgresql.org/docs/current/sql-createrole.html
        // but we need only the name for now
        await sql(_templateObject0 || (_templateObject0 = _taggedTemplateLiteral(["CREATE ROLE ", ""])), sql(rolname));
        const [role] = await sql(_templateObject1 || (_templateObject1 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_roles\n            WHERE\n              rolname = ", "\n          "])), rolname);
        return role;
      },
      // when dropping roles, consider this: https://neon.tech/postgresql/postgresql-administration/postgresql-drop-role
      DELETE: async rolname => {
        await sql(_templateObject10 || (_templateObject10 = _taggedTemplateLiteral(["DROP ROLE ", ""])), sql(rolname));
      }
    }), ...createRESTRoutes("databases", {
      GET: async datname => {
        const results = await sql(_templateObject11 || (_templateObject11 = _taggedTemplateLiteral(["\n            SELECT\n              pg_database.*,\n              role.rolname AS owner_rolname\n            FROM\n              pg_database\n              LEFT JOIN pg_roles role ON pg_database.datdba = role.oid\n            WHERE\n              pg_database.datname = ", "\n          "])), datname);
        if (results.length === 0) {
          return null;
        }
        const columns = await getTableColumns(sql, "pg_database");
        const [database] = results;
        const ownerRole = database.datdba ? {
          oid: database.datdba,
          rolname: database.owner_rolname
        } : null;
        delete database.datdba;
        delete database.owner_rolname;
        return {
          database,
          ownerRole,
          columns
        };
      },
      PUT: async (datname, colname, value) => {
        await alterDatabaseQuery();
      },
      POST: async ({
        datname
      }) => {
        await sql(_templateObject12 || (_templateObject12 = _taggedTemplateLiteral(["CREATE ROLE ", ""])), sql(datname));
        const [database] = await sql(_templateObject13 || (_templateObject13 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_database\n            WHERE\n              datname = ", "\n          "])), datname);
        return database;
      },
      DELETE: async datname => {
        await sql(_templateObject14 || (_templateObject14 = _taggedTemplateLiteral(["DROP DATABASE ", ""])), sql(datname));
      }
    }), {
      endpoint: "GET /.internal/database/api/tables",
      declarationSource: import.meta.url,
      fetch: async request => {
        const publicFilter = request.searchParams.has("public"); // TODO: a dynamic filter param
        const columns = await getTableColumns(sql, "pg_tables");
        const data = await sql(_templateObject15 || (_templateObject15 = _taggedTemplateLiteral(["\n            SELECT\n              *\n            FROM\n              pg_tables ", "\n          "])), publicFilter ? sql(_templateObject16 || (_templateObject16 = _taggedTemplateLiteral(["\n                  WHERE\n                    schemaname = 'public'\n                "]))) : sql(_templateObject17 || (_templateObject17 = _taggedTemplateLiteral([""]))));
        return Response.json({
          columns,
          data
        });
      }
    }, {
      endpoint: "PUT /.internal/database/api/tables/:tableName/columns/name",
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const tableName = request.params.tableName;
        const tableNewName = await request.json();
        await sql(_templateObject18 || (_templateObject18 = _taggedTemplateLiteral(["\n            ALTER TABLE ", "\n            RENAME TO ", ";\n          "])), sql(tableName), sql(tableNewName));
        return Response.json({
          name: tableNewName
        });
      }
    }, {
      endpoint: "PUT /.internal/database/api/tables/:tableName/columns/rowsecurity",
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const tableName = request.params.tableName;
        const value = await request.json();
        if (value === "on") {
          await sql(_templateObject19 || (_templateObject19 = _taggedTemplateLiteral(["\n              ALTER TABLE ", " ENABLE ROW LEVEL SECURITY;\n            "])), sql(tableName));
        } else {
          await sql(_templateObject20 || (_templateObject20 = _taggedTemplateLiteral(["\n              ALTER TABLE ", " DISABLE ROW LEVEL SECURITY;\n            "])), sql(tableName));
        }
        return Response.json({
          rowsecurity: value === "on"
        });
      }
    }, {
      endpoint: "PUT /.internal/database/api/tables/:tableName/columns/:columnName/rows/:rowId",
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
      endpoint: "PUT /.internal/database/api/tables/:name/columns/:columnName/move_before",
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
        const columns = await sql(_templateObject21 || (_templateObject21 = _taggedTemplateLiteral(["\n            SELECT\n              ordinal_position,\n              data_type\n            FROM\n              information_schema.columns\n            WHERE\n              table_name = ", "\n              AND column_name = ", "\n          "])), sql(tableName), sql(columnName));
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
            statusText: message
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
const createRESTRoutes = (resource, {
  GET,
  POST,
  PUT,
  DELETE
}) => {
  const routes = [];
  if (GET) {
    const getRoute = {
      endpoint: "GET /.internal/database/api/".concat(resource, "/:id"),
      declarationSource: import.meta.url,
      fetch: async request => {
        const id = request.params.id;
        const object = await GET(id);
        if (!object) {
          return Response.json({
            message: "".concat(resource, " \"").concat(id, "\" not found")
          }, {
            status: 404
          });
        }
        return Response.json(object);
      }
    };
    routes.push(getRoute);
  }
  if (POST) {
    const postRoute = {
      endpoint: "POST /.internal/database/api/".concat(resource),
      declarationSource: import.meta.url,
      acceptedMediaTypes: ["application/json"],
      fetch: async request => {
        const properties = await request.json();
        const object = await POST(properties);
        return Response.json(object, {
          status: 201
        });
      }
    };
    routes.push(postRoute);
  }
  if (PUT) {
    const putRoute = {
      endpoint: "PUT /.internal/database/api/".concat(resource, "/:id/:property"),
      declarationSource: import.meta.url,
      fetch: async request => {
        const id = request.params.id;
        const property = request.params.property;
        const value = await request.json();
        await PUT(id, property, value);
        return Response.json({
          [property]: value
        });
      }
    };
    routes.push(putRoute);
  }
  if (DELETE) {
    const deleteRoute = {
      endpoint: "DELETE /.internal/database/api/".concat(resource, "/:id"),
      declarationSource: import.meta.url,
      fetch: async request => {
        const id = request.params.id;
        await DELETE(id);
        return new Response(null, {
          status: 204
        });
      }
    };
    routes.push(deleteRoute);
  }
  return routes;
};
const getTableColumns = async (sql, tableName) => {
  const columns = await sql(_templateObject22 || (_templateObject22 = _taggedTemplateLiteral(["\n    SELECT\n      *\n    FROM\n      information_schema.columns\n    WHERE\n      table_name = ", "\n  "])), tableName);
  return columns;
};

export { jsenvPluginDatabaseManager };
