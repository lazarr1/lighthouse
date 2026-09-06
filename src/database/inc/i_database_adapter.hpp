#pragma once

#include "capabilities.hpp"
#include "i_database_session.hpp"
#include "result.hpp"

namespace db {

class iDatabaseAdapter {
  virtual Result<std::unique_ptr<iDatabaseSession>> open() const = 0;
  virtual const Capabilities getCapabilities() const = 0;
};

};
