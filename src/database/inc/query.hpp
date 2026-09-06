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

struct QuerySpec {
    sheetId sheet;
    std::vector<columnId> columns;
    std::uint32_t limit = 100;

    std::optional<std::string> continuation;
};
};
