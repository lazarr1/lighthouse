#pragma once

#include "i_connection.hpp"
#include "internal/sqlite_lib.hpp"

namespace db {

class SqliteConnection : public iConnection {

public:
  explicit SqliteConnection(SqliteHandle db);

  // TODO: transactions with savepoints?
  Result<void> beginTransaction(TransactionMode mode) override;
  Result<void> commit() override;
  Result<void> rollback() override;

  Result<QueryPage> execute(Command cmd) override;

  // virtual AsyncResult<QueryPage> query(QuerySpec spec) = 0;
  // virtual AsyncResult<CommandResult> execute(Command cmd) = 0;
  // void applySchema(plan);

private:
  SqliteHandle db_;
  TransactionMode transactionMode_;
};

}; // namespace db
