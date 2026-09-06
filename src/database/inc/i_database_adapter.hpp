#pragma once

#include "capabilities.hpp"

namespace db {

struct iDatabaseSession;

class iDatabaseAdapter {
  virtual iDatabaseSession open() const = 0;
  virtual const Capabilities getCapabilities() const = 0;
};

};
