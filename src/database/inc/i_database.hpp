#pragma once

#include "capabilities.hpp"
#include "i_connection.hpp"
#include "result.hpp"
#include <memory>

namespace db {

class iDatabase {
public:
  virtual ~iDatabase() = default;

  virtual Result<std::unique_ptr<iConnection>> open() const = 0;
  virtual const Capabilities getCapabilities() const = 0;
};

}; // namespace db
