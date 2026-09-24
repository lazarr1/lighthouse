#pragma once

#include "query.hpp"
#include "result.hpp"

namespace db {
enum class TransactionMode { ReadOnly, ReadWrite };

class iDatabaseSession {
public:
  virtual ~iDatabaseSession() = default;
  // virtual AsyncResult<QueryPage> query(QuerySpec spec) = 0;

  // For now just let user execute whatever they want on SQL side.
  virtual AsyncResult<std::optional<QueryPage>> execute(Command cmd) = 0;

  virtual Result<void> beginTransaction(TransactionMode mode) = 0;
  virtual Result<void> commit() = 0;
  virtual Result<void> rollback() = 0;
  // void applySchema(plan);
};

}; // namespace db
