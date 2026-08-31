#pragma once

namespace db {

class IConnection {
public:
    virtual ~IConnection() = default;

    virtual bool isHealthy() const = 0;
    virtual void close() = 0;
};

}
