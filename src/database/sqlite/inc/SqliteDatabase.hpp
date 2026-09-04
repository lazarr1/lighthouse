#pragma once

#include <memory>

#include "database.hpp"

struct sqlite3;

namespace db {

class SqliteDatabase final : public IDatabase {
public:
  explicit SqliteDatabase(sqlite3 *database) noexcept;

  SqliteDatabase(const SqliteDatabase &) = delete;
  SqliteDatabase &operator=(const SqliteDatabase &) = delete;
  SqliteDatabase(SqliteDatabase &&) noexcept = default;
  SqliteDatabase &operator=(SqliteDatabase &&) noexcept = default;

  Result<std::unique_ptr<IConnection>> connect() override;

private:
  struct Deleter {
    void operator()(sqlite3 *database) const noexcept;
  };

  std::unique_ptr<sqlite3, Deleter> db_;
};

} // namespace db
