#include <sqlite3.h>

#include <memory>

#include "i_database_session.hpp"
#include "sqlite_database_session.hpp"

namespace db {
namespace {

struct SqliteStatementCloser {
  void operator()(sqlite3_stmt *statement) const noexcept {
    if (statement) {
      sqlite3_finalize(statement);
    }
  }
};

using SqliteStatement = std::unique_ptr<sqlite3_stmt, SqliteStatementCloser>;

Result<value> readColumn(sqlite3_stmt *statement, const int column) {
  switch (sqlite3_column_type(statement, column)) {
  case SQLITE_NULL:
    return value{std::monostate{}};
  case SQLITE_INTEGER:
    return value{
        static_cast<std::int64_t>(sqlite3_column_int64(statement, column))};
  case SQLITE_FLOAT:
    return value{sqlite3_column_double(statement, column)};
  case SQLITE_TEXT: {
    const auto *text =
        reinterpret_cast<const char *>(sqlite3_column_text(statement, column));
    return value{std::string(text ? text : "")};
  }
  default:
    return std::unexpected(DbError(DbErrorCode::NotImplemented));
  }
}

} // namespace

SqliteDatabaseSession::SqliteDatabaseSession(SqliteHandle db)
    : db_(std::move(db)), transactionMode_(TransactionMode::ReadOnly),
      transactionStarted_(false) {}

Result<void> SqliteDatabaseSession::beginTransaction(TransactionMode mode) {
  if (transactionStarted_) {
    return std::unexpected(DbError(DbErrorCode::TransactionAlreadyStarted));
  }

  int result = 0;
  switch (mode) {
  case (TransactionMode::ReadOnly): {
    result = sqlite3_exec(db_.get(), "BEGIN DEFERRED;", NULL, NULL, NULL);
    break;
  };
  case (TransactionMode::ReadWrite): {
    result = sqlite3_exec(db_.get(), "BEGIN IMMEDIATE;", NULL, NULL, NULL);
    break;
  };
  default:
    return std::unexpected(DbError(DbErrorCode::UnknownTransactionType));
  };

  if (result != SQLITE_OK) {
    return std::unexpected(DbError(DbErrorCode::UnableToStartTransaction,
                                   result, sqlite3_errmsg(db_.get())));
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
    return std::unexpected(DbError(DbErrorCode::UnableToStartTransaction,
                                   result, sqlite3_errmsg(db_.get())));
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
    return std::unexpected(DbError(DbErrorCode::UnableToStartTransaction,
                                   result, sqlite3_errmsg(db_.get())));
  }

  transactionStarted_ = false;

  return {};
}

Result<QueryPage> SqliteDatabaseSession::execute(Command cmd) {

  Result<QueryPage> res;
  sqlite3_stmt *rawStatement = nullptr;
  const int prepareResult = sqlite3_prepare_v2(db_.get(), cmd.command.c_str(),
                                               -1, &rawStatement, nullptr);
  SqliteStatement statement(rawStatement);

  if (prepareResult != SQLITE_OK) {
    return std::unexpected(DbError(DbErrorCode::CommandFailed, prepareResult,
                                   sqlite3_errmsg(db_.get())));
  }

  if (!statement) {
    return QueryPage();
  }

  const int columnCount = sqlite3_column_count(statement.get());
  QueryPage page;
  if (columnCount > 0) {
    page.columns.reserve(static_cast<std::size_t>(columnCount));
    for (int column = 0; column < columnCount; ++column) {
      page.columns.push_back(static_cast<columnId>(column));
    }
  }

  rowId resultRowId = 0;
  for (;;) {
    const int stepResult = sqlite3_step(statement.get());
    if (stepResult == SQLITE_DONE) {
      return page;
    }
    if (stepResult != SQLITE_ROW) {
      return std::unexpected(DbError(DbErrorCode::CommandFailed, stepResult,
                                     sqlite3_errmsg(db_.get())));
    }

    row resultRow{.id = resultRowId++, .values = {}};
    resultRow.values.reserve(static_cast<std::size_t>(columnCount));
    for (int column = 0; column < columnCount; ++column) {
      auto columnValue = readColumn(statement.get(), column);
      if (!columnValue) {
        return std::unexpected(columnValue.error());
      }
      resultRow.values.push_back(std::move(*columnValue));
    }
    page.rows.push_back(std::move(resultRow));
  }

  return page;
}

// AsyncResult<QueryPage> SqliteDatabaseSession::query(QuerySpec spec) {}
// AsyncResult<CommandResult> SqliteDatabaseSession::execute(Command cmd) {}

}; // namespace db
