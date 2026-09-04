#pragma once

#include <string>
#include <vector>

#include "value.hpp"

namespace db {

class Command {
public:
  virtual ~Command() = default;
};

struct SqlCommand : Command {
  std::string statement;
  std::vector<Value> parameters;
};

} // namespace db
