#pragma once

#include "i_database_adapter.hpp"
#include "config.hpp"
#include "capabilities.hpp"

#include <filesystem>
#include <sqlite3.h>

namespace db {

enum class SQLiteDurability {
    Full,
    Normal
};

struct SqliteConfig {
    std::filesystem::path path;
    OpenMode openMode = OpenMode::ReadWriteCreate;
    SQLiteDurability durability = SQLiteDurability::Full;
};

class SqliteDatabaseAdapter final : iDatabaseAdapter {
public: 
  explicit SqliteDatabaseAdapter(const SqliteConfig conf);

  iDatabaseSession open() const override;
  const Capabilities getCapabilities() const override;

private:
  SqliteConfig conf;
};

};
