#pragma once

#include "i_database_adapter.hpp"

#include <sqlite3.h>


class sqlliteDatabaseAdapter final : iDatabaseAdapter {
  iDatabaseSession open(config);
  capabilities getCapabilities();
};
