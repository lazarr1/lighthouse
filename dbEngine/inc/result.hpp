#pragma once

#include <expected>

#include "error.hpp"

namespace db {

template<typename T>
using Result = std::expected<T, Error>;

}

