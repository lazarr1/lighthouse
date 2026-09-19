#pragma once

#include "i_database_session.hpp"
#include "sqlite_database_adapter.hpp"

namespace db {

class SqliteDatabaseSession : public iDatabaseSession {

public:
  explicit SqliteDatabaseSession(SqliteHandle db);

  // TODO: transactions with savepoints?
  Result<void> beginTransaction(TransactionMode mode);
  Result<void> commit();
  Result<void> rollback();

  // virtual AsyncResult<QueryPage> query(QuerySpec spec) = 0;
  // virtual AsyncResult<CommandResult> execute(Command cmd) = 0;
  // void applySchema(plan);

private:
  SqliteHandle db_;
  TransactionMode transactionMode_;
  bool transactionStarted_;
};

}; // namespace db
