#include <sqlite3.h>

#include "sqlite_database_session.hpp"
#include "i_database_session.hpp"

namespace db {

SqliteDatabaseSession::SqliteDatabaseSession(SqliteHandle db)
    : db_(std::move(db)), transactionMode_(TransactionMode::ReadOnly), transactionStarted_(false) {}

Result<void> SqliteDatabaseSession::beginTransaction(TransactionMode mode) {
  if (!transactionStarted_) {
    return std::unexpected(DbError(DbErrorCode::TransactionAlreadyStarted));
  }

  int result = 0;
  switch (mode) {
    case(TransactionMode::ReadOnly) : {
      result = sqlite3_exec(db_.get(), "BEGIN DEFERRED;", NULL, NULL, NULL);
      break;
    };
    case(TransactionMode::ReadWrite) : {
      result = sqlite3_exec(db_.get(), "BEGIN IMMEDIATE;", NULL, NULL, NULL);
      break;
    };
    default:
      return std::unexpected(DbError(DbErrorCode::UnknownTransactionType));
  };

  if (result != SQLITE_OK) {
    return std::unexpected(DbError(
              DbErrorCode::UnableToStartTransaction, 
              result, 
              sqlite3_errmsg(db_.get()
           )));
  }

  transactionMode_ = mode;
  transactionStarted_ = true;
  return {};
}

Result<void> SqliteDatabaseSession::commit() {
  if (!transactionStarted_) {
    return std::unexpected(DbError(DbErrorCode::NoTransactionPresent));
  }

  const int result = sqlite3_exec(db_.get(), "COMMIT", NULL, NULL, NULL);
  if (result != SQLITE_OK) {
    return std::unexpected(DbError(
              DbErrorCode::UnableToStartTransaction, 
              result, 
              sqlite3_errmsg(db_.get()
           )));
  }

  transactionStarted_ = false;

  return {};
}

Result<void> SqliteDatabaseSession::rollback() {
  if (!transactionStarted_) {
    return std::unexpected(DbError(DbErrorCode::NoTransactionPresent));
  }

  // TODO: transactions with savepoints
  const int result = sqlite3_exec(db_.get(), "ROLLBACK", NULL, NULL, NULL);
  if (result != SQLITE_OK) {
    return std::unexpected(DbError(
              DbErrorCode::UnableToStartTransaction, 
              result, 
              sqlite3_errmsg(db_.get()
           )));
  }

  transactionStarted_ = false;


  return {};
}

// AsyncResult<QueryPage> SqliteDatabaseSession::query(QuerySpec spec) {}
// AsyncResult<CommandResult> SqliteDatabaseSession::execute(Command cmd) {}

}; // namespace db
