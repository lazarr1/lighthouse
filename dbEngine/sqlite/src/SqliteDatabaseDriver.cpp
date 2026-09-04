#include <memory>
#include <string>
#include <utility>

#include "SqliteDatabase.hpp"
#include "SqliteDatabaseDriver.hpp"
#include "sqlite3.h"

namespace db {

Result<std::unique_ptr<IDatabase>>
SqliteDatabaseDriver::open(const DatabaseConfig &config) {
  sqlite3 *raw_database = nullptr;
  const int result =
      sqlite3_open(config.connection_string.c_str(), &raw_database);

  // sqlite3_open() can return a non-null handle even when opening fails. Take
  // ownership before inspecting the result so every return path closes it.
  SqliteDatabase database(raw_database);

  if (result != SQLITE_OK) {
    return std::unexpected(
        Error{.code = ErrorCode::ConnectionFailed,
              .message = raw_database ? sqlite3_errmsg(raw_database)
                                      : "Could not open database",
              .driver = "sqlite3",
              .nativeError = sqlite3_errstr(result)});
  }

  return std::make_unique<SqliteDatabase>(std::move(database));
}

} // namespace db
