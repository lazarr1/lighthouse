#pragma once

#include "capabilities.hpp"
#include "config.hpp"
#include "i_database_adapter.hpp"
#include "result.hpp"

#include <filesystem>
#include <memory>
#include <sqlite3.h>

struct sqlite3;

namespace db {

enum class SQLiteDurability {
    Full,
    Normal
};

struct SqliteCloser {
    void operator()(sqlite3* db) const noexcept {
        if (db) {
            sqlite3_close_v2(db);
        }
    }
};

using SqliteHandle = std::unique_ptr<sqlite3, SqliteCloser>;

struct SqliteConfig {
    std::filesystem::path path;
    OpenMode openMode = OpenMode::ReadWriteCreate;
    SQLiteDurability durability = SQLiteDurability::Full;
};

class SqliteDatabaseAdapter final : iDatabaseAdapter {
public: 
  explicit SqliteDatabaseAdapter(const SqliteConfig conf);

  Result<std::unique_ptr<iDatabaseSession>> open() const override;
  const Capabilities getCapabilities() const override;

private:
  SqliteConfig conf;
};

};
