#pragma once
#include <memory>

struct sqlite3;

namespace db {
struct SqliteCloser {
  void operator()(sqlite3 *db) const noexcept;
};

using SqliteHandle = std::unique_ptr<sqlite3, SqliteCloser>;
}; // namespace db
