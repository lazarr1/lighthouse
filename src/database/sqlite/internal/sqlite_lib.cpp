#include "sqlite_lib.hpp"
#include <sqlite3.h>

namespace db {
void SqliteCloser::operator()(sqlite3 *db) const noexcept {
  if (db)
    sqlite3_close_v2(db);
}
}; // namespace db
