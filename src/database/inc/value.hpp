#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <variant>
#include <vector>

namespace db {

struct Null {};

using Blob = std::vector<std::byte>;

using Value = std::variant<Null, bool, std::int64_t, double, std::string, Blob>;

} // namespace db
