#pragma once

#include <string>
#include <cstdint>
#include <vector>

#include "value.hpp"

namespace db {

using sheetId = uint32_t;
using columnId = uint32_t;
using rowId = uint32_t;

enum class ColumnType {
  Null,
  Text,
  Integer,
  Real,
  Boolean,
  // Timestamp
};

struct Sheet {
  sheetId id;
  std::string displayName;
  std::string physicalName;
};

struct Column {
  columnId id;
  std::string displayName;
  std::string physicalName;
  ColumnType type; 
  uint32_t displayOrder;
};

struct row {
    rowId id;
    std::vector<value> values;
};

}; //namespace db
