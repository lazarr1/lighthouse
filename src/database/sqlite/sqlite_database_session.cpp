#include <sqlite3.h>

#include "sqlite_database_session.hpp"

namespace db {
SqliteDatabaseSession::SqliteDatabaseSession(SqliteHandle db)
    : db_(std::move(db)) {}
void SqliteDatabaseSession::begin(TransactionMode mode) {}
void SqliteDatabaseSession::commit() {}
void SqliteDatabaseSession::rollback() {}
}; // namespace db
