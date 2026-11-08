#include "query.hpp"
#include "sqlite_database_adapter.hpp"
#include "sqlite_database_session.hpp"
#include <iostream>
#include <string>
#include <variant>

int main(int argc, char *argv[]) {

  if (argc < 2) {
    std::cout << "Usage: " << argv[0] << " <database_path>" << std::endl;

    return 1;
  }

  db::SqliteConfig conf(argv[1]);

  std::string line;

  db::SqliteDatabaseAdapter adapter(conf);
  auto result = adapter.open();

  if (!result) {
    std::cout << "failed to open session for db: " << argv[1] << std::endl;
  }

  auto session = std::move(*result);

  while (std::getline(std::cin, line)) {

    db::Command command(line);
    auto resp = session->execute(command);
    if (!resp) {
      std::cout << resp.error().message.value() << std::endl;
      continue;
    }

    auto page = (*resp);
    if (!page.rows.empty()) {
      auto rows = page.rows;
      for (auto &col : rows) {
        for (db::value &val : col.values) {
          if (std::holds_alternative<double>(val)) {
            std::cout << std::get<double>(val) << std::endl;
          } else if (std::holds_alternative<std::string>(val)) {
            std::cout << std::get<std::string>(val) << std::endl;
          } else if (std::holds_alternative<std::int64_t>(val)) {
            std::cout << std::get<std::int64_t>(val) << std::endl;
          } else {
            std::cout << "unhandled cout type" << std::endl;
          }
        }
      }
    }
  }
}
