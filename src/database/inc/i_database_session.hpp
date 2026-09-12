#pragma once

#include "query.hpp"
#include "result.hpp"

namespace db {
enum class TransactionMode { ReadOnly, ReadWrite };

struct CommandResult;
struct Command;

class iDatabaseSession {

  virtual AsyncResult<QueryPage> query(QuerySpec spec) = 0;
  virtual AsyncResult<CommandResult> execute(Command cmd) = 0;

  virtual void beginTransaction(TransactionMode mode) = 0;
  virtual void commit() = 0;
  virtual void rollback() = 0;
  // void applySchema(plan);
};

}; // namespace db
