#pragma once

#include "i_database_session.hpp"
#include "sqlite_database_adapter.hpp"

namespace db {

class SqliteDatabaseSession : public iDatabaseSession {

public:
  explicit SqliteDatabaseSession(SqliteHandle db);

  DbError beginTransaction(TransactionMode mode);

  // virtual AsyncResult<QueryPage> query(QuerySpec spec) = 0;
  // virtual AsyncResult<CommandResult> execute(Command cmd) = 0;
  // void commit();
  // void rollback();

private:
  SqliteHandle db_;
  TransactionMode transactionMode_;
};

}; // namespace db
