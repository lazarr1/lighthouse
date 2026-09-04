#pragma once

#include <memory>

#include <sqlite3.h>

#include "database.hpp"

namespace db {

class SqliteDatabase final : public IDatabase {
public:
  explicit SqliteDatabase(sqlite3 *db) noexcept;

  SqliteDatabase(const SqliteDatabase &) = delete;
  SqliteDatabase &operator=(const SqliteDatabase &) = delete;
  SqliteDatabase(SqliteDatabase &&) noexcept = default;
  SqliteDatabase &operator=(SqliteDatabase &&) noexcept = default;

  Result<std::unique_ptr<IConnection>> connect() override;

private:
  std::unique_ptr<sqlite3, decltype(&sqlite3_close_v2)> db_;
};

}; // namespace db
