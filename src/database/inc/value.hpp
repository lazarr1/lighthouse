#pragma once

#include <variant>
#include <string>


namespace db {

using value = std::variant<
    std::monostate, // SQL NULL
    std::string,
    std::int64_t,
    double,
    bool
    // Timestamp
>;

};
