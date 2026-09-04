#pragma once

#include "databasedriver.hpp"

namespace db {

class SqliteDatabaseDriver final : public IDatabaseDriver {
public:
  ~SqliteDatabaseDriver() override = default;

  Result<std::unique_ptr<IDatabase>>
  open(const DatabaseConfig &config) override;
};

} // namespace db
