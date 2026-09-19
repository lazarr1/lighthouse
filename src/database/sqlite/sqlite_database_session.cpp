#include <sqlite3.h>

#include "sqlite_database_session.hpp"
#include "i_database_session.hpp"

namespace db {

SqliteDatabaseSession::SqliteDatabaseSession(SqliteHandle db)
    : db_(std::move(db)), transactionMode_(TransactionMode::ReadOnly) {}

DbError SqliteDatabaseSession::beginTransaction(TransactionMode mode) {

  int result = 0;
  switch (mode) {
    case(TransactionMode::ReadOnly) : {
      transactionMode_ = TransactionMode::ReadOnly;
      result = sqlite3_exec(db_.get(), "BEGIN DEFERRED;", NULL, NULL, NULL);
      break;
    };
    case(TransactionMode::ReadWrite) : {
      transactionMode_ = TransactionMode::ReadWrite;
      result = sqlite3_exec(db_.get(), "BEGIN IMMEDIATE;", NULL, NULL, NULL);
      break;
    };
    default:
      return DbError(DbErrorCode::UnknownTransactionType);
  };

  if (result == SQLITE_OK) {
    return DbError(DbErrorCode::NoError);
  }

  return DbError(DbErrorCode::UnableToStartTransaction, result, sqlite3_errmsg(db_.get()));

}

// AsyncResult<QueryPage> SqliteDatabaseSession::query(QuerySpec spec) {}
// AsyncResult<CommandResult> SqliteDatabaseSession::execute(Command cmd) {}
// void SqliteDatabaseSession::commit() {}
// void SqliteDatabaseSession::rollback() {}

}; // namespace db
