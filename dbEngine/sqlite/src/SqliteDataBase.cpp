#include "SqliteDatabase.hpp"

namespace db {

SqliteDatabase::SqliteDatabase(sqlite3 *db) noexcept
    : db_(db, sqlite3_close_v2) {}

Result<std::unique_ptr<IConnection>> SqliteDatabase::connect() {
  return std::unexpected(Error{.code = ErrorCode::Unsupported,
                               .message = "SQLite connections are not implemented",
                               .driver = "sqlite3",
                               .nativeError = {}});
}

}; // namespace db
