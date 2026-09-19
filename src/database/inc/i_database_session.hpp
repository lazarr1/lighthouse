#pragma once

#include "query.hpp"
#include "result.hpp"

namespace db {
enum class TransactionMode { ReadOnly, ReadWrite };

struct CommandResult;
struct Command;

class iDatabaseSession {
  public:
  virtual ~iDatabaseSession() = default;
  // virtual AsyncResult<QueryPage> query(QuerySpec spec) = 0;
  // virtual AsyncResult<CommandResult> execute(Command cmd) = 0;

  virtual Result<void> beginTransaction(TransactionMode mode) = 0;
  virtual Result<void> commit() = 0;
  Result<void> rollback();
  // void applySchema(plan);
};

}; // namespace db
