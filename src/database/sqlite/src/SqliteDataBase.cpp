#include "SqliteDatabase.hpp"

#include <sqlite3.h>

namespace db {

void SqliteDatabase::Deleter::operator()(sqlite3 *database) const noexcept {
  static_cast<void>(sqlite3_close_v2(database));
}

SqliteDatabase::SqliteDatabase(sqlite3 *database) noexcept : db_(database) {}

Result<std::unique_ptr<IConnection>> SqliteDatabase::connect() {
  return std::unexpected(
      Error{.code = ErrorCode::Unsupported,
            .message = "SQLite connections are not implemented",
            .driver = "sqlite3",
            .nativeError = {}});
}

} // namespace db
