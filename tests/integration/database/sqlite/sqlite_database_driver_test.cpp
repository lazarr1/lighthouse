#include <SqliteDatabaseDriver.hpp>

#include <cstdint>
#include <filesystem>
#include <random>
#include <stdexcept>
#include <string>
#include <system_error>
#include <utility>

#include <gtest/gtest.h>

#include <error.hpp>

namespace {

class TemporaryDirectory {
public:
  TemporaryDirectory() {
    const auto nonce = static_cast<std::uint64_t>(std::random_device{}());
    const auto temporary_root = std::filesystem::temp_directory_path();

    for (std::uint32_t attempt = 0; attempt < 100; ++attempt) {
      auto candidate =
          temporary_root / ("lighthouse-tests-" + std::to_string(nonce) + "-" +
                            std::to_string(attempt));
      std::error_code error;
      if (std::filesystem::create_directory(candidate, error)) {
        path_ = std::move(candidate);
        return;
      }
      if (error && error != std::errc::file_exists) {
        throw std::filesystem::filesystem_error(
            "Could not create a test directory", candidate, error);
      }
    }

    throw std::runtime_error("Could not allocate a unique test directory");
  }

  TemporaryDirectory(const TemporaryDirectory &) = delete;
  TemporaryDirectory &operator=(const TemporaryDirectory &) = delete;

  ~TemporaryDirectory() {
    std::error_code error;
    static_cast<void>(std::filesystem::remove_all(path_, error));
  }

  [[nodiscard]] const std::filesystem::path &path() const noexcept {
    return path_;
  }

private:
  std::filesystem::path path_;
};

class SqliteDatabaseDriverTest : public ::testing::Test {
protected:
  db::SqliteDatabaseDriver driver_;
  TemporaryDirectory temporary_directory_;
};

TEST_F(SqliteDatabaseDriverTest, OpensInMemoryDatabase) {
  auto database =
      driver_.open(db::DatabaseConfig{.connection_string = ":memory:"});

  ASSERT_TRUE(database.has_value());
  EXPECT_NE(database.value(), nullptr);
}

TEST_F(SqliteDatabaseDriverTest, MapsOpenFailureToDatabaseError) {
  const auto database_path =
      temporary_directory_.path() / "missing" / "database.sqlite";

  auto database = driver_.open(db::DatabaseConfig{
      .connection_string = database_path.string(),
  });

  ASSERT_FALSE(database.has_value());
  EXPECT_EQ(database.error().code, db::ErrorCode::ConnectionFailed);
  EXPECT_EQ(database.error().driver, "sqlite3");
  EXPECT_FALSE(database.error().message.empty());
  EXPECT_FALSE(database.error().nativeError.empty());
  EXPECT_FALSE(std::filesystem::exists(database_path));
}

TEST_F(SqliteDatabaseDriverTest, ReportsUnsupportedConnections) {
  auto database =
      driver_.open(db::DatabaseConfig{.connection_string = ":memory:"});
  ASSERT_TRUE(database.has_value());

  const auto connection = database.value()->connect();

  ASSERT_FALSE(connection.has_value());
  EXPECT_EQ(connection.error().code, db::ErrorCode::Unsupported);
  EXPECT_EQ(connection.error().driver, "sqlite3");
}

TEST_F(SqliteDatabaseDriverTest, ReleasesFileHandleOnDestruction) {
  const auto database_path = temporary_directory_.path() / "database.sqlite";

  {
    auto database = driver_.open(db::DatabaseConfig{
        .connection_string = database_path.string(),
    });
    ASSERT_TRUE(database.has_value());
    ASSERT_TRUE(std::filesystem::exists(database_path));
  }

  std::error_code error;
  EXPECT_TRUE(std::filesystem::remove(database_path, error));
  EXPECT_FALSE(error);
}

} // namespace
