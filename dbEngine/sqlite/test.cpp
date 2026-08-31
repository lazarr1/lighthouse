#include <sqlite3.h>
#include <print>


int main()
{
  std::println("Hello DB"); 

  sqlite3 *db = NULL;

  // Should initialise in RAII wrapper
  if (auto err = sqlite3_open("test.db", &db); err != SQLITE_OK)
  {
    std::println("Error occured: %i", err);
  } else {
    std::println("Database object created!!");
  }

  // sqlite3_prepare_v2(
}

