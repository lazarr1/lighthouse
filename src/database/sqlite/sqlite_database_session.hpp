#pragma once

#include "i_database_session.hpp"
#include "sqlite_database_adapter.hpp"

namespace db {

class SqliteDatabaseSession : public iDatabaseSession {

public:

  explicit SqliteDatabaseSession(SqliteHandle db);

private:
  SqliteHandle db_;
};

};
