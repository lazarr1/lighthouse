#pragma one

#include <memory>
#include <string>

#include "database.hpp"

struct DatabaseConfig {
  std::string connection_string;
};

class IDatabaseDriver {
public:
    virtual ~IDatabaseDriver() = default;

    virtual std::unique_ptr<IDatabase>
    open(const DatabaseConfig&) = 0;
};
