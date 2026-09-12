#pragma once

#include "i_database_session.hpp"
#include "sqlite_database_adapter.hpp"

namespace db {

class SqliteDatabaseSession : public iDatabaseSession {

public:
  explicit SqliteDatabaseSession(SqliteHandle db);
  void begin(TransactionMode mode);
  void commit();
  void rollback();

private:
  SqliteHandle db_;
};

}; // namespace db
