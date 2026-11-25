#include "sqlite_database.hpp"
#include "i_connection.hpp"
#include "internal/sqlite_lib.hpp"
#include "result.hpp"
#include "sqlite_connection.hpp"

#include <expected>
#include <sqlite3.h>

namespace db {

SqliteDatabase::SqliteDatabase(const SqliteConfig conf)
    : conf(conf) {}

Result<std::unique_ptr<iConnection>> SqliteDatabase::open() const {
  sqlite3 *db = nullptr;

  const int openModeFlags = getOpenModeFlags();

  // Initialised an immediately pass into smart pointer. sqlite3_open can fail
  // and still return a non-null handle.
  const int result =
      sqlite3_open_v2(conf.path.c_str(), &db, openModeFlags, nullptr);
  SqliteHandle dbHndlr{db};

  if (result != SQLITE_OK) {
    return std::unexpected(
        DbError(DbErrorCode::FailedToOpenDatabase, result,
                db ? sqlite3_errmsg(db) : sqlite3_errstr(result)));
  }

  return std::make_unique<SqliteConnection>(std::move(dbHndlr));
}

const Capabilities SqliteDatabase::getCapabilities() const {
  // TODO: Move
  return {
      .writable = (conf.openMode == OpenMode::ReadWrite) ||
                  (conf.openMode == OpenMode::ReadWriteCreate),
      .transactions = false,
      .readOnlyTransactions = false,

      .schema = {.addColumn = SupportLevel::Unsupported,
                 .renameColumn = SupportLevel::Unsupported,
                 .dropColumn = SupportLevel::Unsupported,
                 .changeColumnType = SupportLevel::Unsupported,
                 .transactionalChanges = false},

      .concurrency = {.concurrentReads = false,
                      .readsDuringWrite = false,
                      .maxConcurrentWriters = 0},
  };
}

int SqliteDatabase::getOpenModeFlags() const {
  switch (conf.openMode) {
  case OpenMode::ReadOnly:
    return SQLITE_OPEN_READONLY;
  case OpenMode::ReadWrite:
    return SQLITE_OPEN_READWRITE;
  case OpenMode::ReadWriteCreate:
    return SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE;
  default:
    return SQLITE_OPEN_READONLY;
  }
}

} // namespace db
