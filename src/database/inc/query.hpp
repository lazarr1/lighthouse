#pragma once

#include <optional>
#include <vector>

#include "sheet.hpp"

namespace db {
struct QueryPage {
  std::vector<columnId> columns;
  std::vector<row> rows;

  // Absent when there are no more results.
  std::optional<std::string> next;
};

struct Command {
  // sheetId sheet;
  // std::vector<columnId> columns;
  // uint32_t limit = 100;

  // For now let users send whatever commands
  // Limits probably have to start being enforced at some point.
  std::string command;
  // std::optional<std::string> continuation;
};
}; // namespace db
