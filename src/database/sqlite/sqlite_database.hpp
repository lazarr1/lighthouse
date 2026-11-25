#pragma once

#include "capabilities.hpp"
#include "config.hpp"
#include "i_database.hpp"
#include "result.hpp"

#include <filesystem>
#include <memory>

struct sqlite3;

namespace db {

enum class SQLiteDurability { Full, Normal };

struct SqliteConfig {
  std::filesystem::path path;
  OpenMode openMode = OpenMode::ReadWriteCreate;
  SQLiteDurability durability = SQLiteDurability::Full;
};

class SqliteDatabase final : public iDatabase {
public:
  explicit SqliteDatabase(const SqliteConfig conf);

  Result<std::unique_ptr<iConnection>> open() const override;
  const Capabilities getCapabilities() const override;

private:
  SqliteConfig conf;
  int getOpenModeFlags() const;
};

}; // namespace db
