#pragma once

#include <memory>

#include "connection.hpp"
#include "result.hpp"

namespace db {

class IDatabase {
public:
    virtual ~IDatabase() = default;

    virtual Result<std::unique_ptr<IConnection>>
    connect() = 0;
};

}
