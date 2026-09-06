#include "result.hpp"
#include "sqlite_database_adapter.hpp"
#include "i_database_adapter.hpp"
#include "i_database_session.hpp"

#include <print>

int main(void) {
  db::SqliteDatabaseAdapter test({.path = "test.db"}); 

  std::println("test: {:p}", static_cast<const void *>(&test));
  return 1;
}
