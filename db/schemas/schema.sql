CREATE TABLE IF NOT EXISTS users (
  id serial NOT NULL PRIMARY KEY,
  name text NOT NULL,
);

CREATE TABLE IF NOT EXISTS sessions (id serial NOT NULL PRIMARY KEY,);

CREATE TABLE IF NOT EXISTS users_session (
  user_id int NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_id int NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  UNIQUE (user_id, session_id)
);
