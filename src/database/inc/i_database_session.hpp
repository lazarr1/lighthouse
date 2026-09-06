#pragma once

#include <variant>

#include "result.hpp"
#include "query.hpp"


namespace db {
enum class TransactionMode {
  ReadOnly,
  ReadWrite
};

using DbValue = std::variant<
    std::monostate, // SQL NULL
    std::string,
    std::int64_t,
    double,
    bool
    // Timestamp
>;

class iDatabaseSession {

  virtual AsyncResult<QueryPage> query(QuerySpec spec) = 0;
  virtual void begin(TransactionMode mode) = 0;
  virtual void commit() = 0;
  virtual void rollback() = 0;
  // void applySchema(plan);
};

};
