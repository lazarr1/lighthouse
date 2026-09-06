#pragma once

#include "capabilities.hpp"
#include "i_database_session.hpp"

namespace db {

class iDatabaseAdapter {
  virtual iDatabaseSession open() const = 0;
  virtual const Capabilities getCapabilities() const = 0;
};

};
