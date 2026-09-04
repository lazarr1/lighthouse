#include <iostream>
#include <print>
#include <sqlite3.h>

int main() {
  std::println("Hello DB");

  sqlite3 *db = nullptr;

  // Should initialise in RAII wrapper
  if (auto err = sqlite3_open("test.db", &db);
      err != SQLITE_OK) // v2 can be used to set read/write permissions
  {
    std::println("Error occured: %i", err);
  } else {
    std::println("Database object created!!");
  }

  // sqlite3_prepare_v2(db,
  // 2. Define the multi-step SQL string
  const char *sql = "CREATE TABLE IF NOT EXISTS my_table (test1 INTEGER, test2 "
                    "INTEGER, test3 INTEGER);"
                    "INSERT INTO my_table (test1, test2, test3) VALUES (1, 2, "
                    "3), (4, 5, 6), (1, 7, 8);"
                    "SELECT * FROM my_table WHERE test1 = 1;";

  // need to figure out how to delete

  char *errMsg = nullptr;

  // 3. Define a callback function to handle the rows returned by SELECT
  auto callback = [](void *data, int argc, char **argv,
                     char **azColName) -> int {
    for (int i = 0; i < argc; i++) {
      std::cout << azColName[i] << " = " << (argv[i] ? argv[i] : "NULL")
                << " | ";
    }
    std::cout << "\n";
    return 0; // Return 0 to continue reading rows
  };

  // 4. Execute the SQL string
  std::cout << "Executing SQL queries...\n\n--- Results ---\n";
  int rc = sqlite3_exec(db, sql, callback, nullptr, &errMsg);

  // 5. Handle errors and clean up resources
  if (rc != SQLITE_OK) {
    std::cerr << "SQL error: " << errMsg << "\n";
    sqlite3_free(errMsg);
  }

  sqlite3_close(db);
  return 0;
}
