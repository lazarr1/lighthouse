#pragma once

#include <memory>
#include <string>

#include "database.hpp"
#include "result.hpp"

namespace db {

struct DatabaseConfig {
  std::string connection_string;
};

class IDatabaseDriver {
public:
  virtual ~IDatabaseDriver() = default;

  virtual Result<std::unique_ptr<IDatabase>>
  open(const DatabaseConfig &config) = 0;
};

} // namespace db
