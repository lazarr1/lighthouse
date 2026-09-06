#include "i_database_session.hpp"
#include "sqlite_database_adapter.hpp"
#include "result.hpp"
#include "sqlite_database_session.hpp"

#include <expected>
#include <sqlite3.h>


namespace db { 

SqliteDatabaseAdapter::SqliteDatabaseAdapter(const SqliteConfig conf) 
  : conf(conf) {

}

Result<std::unique_ptr<iDatabaseSession>> SqliteDatabaseAdapter::open() const {
  sqlite3 *db;
  
  // Initialised an immediately pass into smart pointer. sqlite3_open can fail and still
  // return a non-null handle.
  const int result =
      sqlite3_open(conf.path.c_str(), &db);
  SqliteHandle dbHndlr {db};

  if (result != SQLITE_OK) {
    return std::unexpected(DbError {
        .ec = DbErrorCode::FailedToOpenDatabase,
        .nativeEc = result,
        .message = db ? sqlite3_errmsg(db) : sqlite3_errstr(result)
    });
  }

  return std::make_unique<iDatabaseSession>(SqliteDatabaseSession(std::move(dbHndlr)));
}

const Capabilities SqliteDatabaseAdapter::getCapabilities() const {
  // TODO: Move
  return {
      .writable = (conf.openMode == OpenMode::ReadWrite) || (conf.openMode == OpenMode::ReadWriteCreate),
      .transactions = false,
      .readOnlyTransactions = false,

      .schema = {
          .addColumn = SupportLevel::Unsupported,
          .renameColumn = SupportLevel::Unsupported,
          .dropColumn = SupportLevel::Unsupported,
          .changeColumnType = SupportLevel::Unsupported,
          .transactionalChanges = false
      },

      .concurrency = {
          .concurrentReads = false,
          .readsDuringWrite = false,
          .maxConcurrentWriters = 0
      },
  };
}

}
