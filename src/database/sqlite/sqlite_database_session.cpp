#include <sqlite3.h>

#include "sqlite_database_session.hpp"

namespace db {
SqliteDatabaseSession::SqliteDatabaseSession(SqliteHandle db)
    : db_(std::move(db)) {}

AsyncResult<QueryPage> SqliteDatabaseSession::query(QuerySpec spec) {}
AsyncResult<CommandResult> SqliteDatabaseSession::execute(Command cmd) {}

void SqliteDatabaseSession::beginTransaction(TransactionMode mode) {}
void SqliteDatabaseSession::commit() {}
void SqliteDatabaseSession::rollback() {}

}; // namespace db
