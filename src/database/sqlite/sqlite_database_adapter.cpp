#include "sqlite_database_adapter.hpp"
#include "i_database_adapter.hpp"


namespace db { 

struct iDatabaseSession {
  int temp;
};

class config {


};

SqliteDatabaseAdapter::SqliteDatabaseAdapter(const SqliteConfig conf) 
  : conf(conf) {

}

iDatabaseSession SqliteDatabaseAdapter::open() const {

  iDatabaseSession ret{ .temp = 0 };

  return ret;
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
