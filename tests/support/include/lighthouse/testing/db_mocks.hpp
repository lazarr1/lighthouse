#pragma once

#include <memory>

#include <gmock/gmock.h>

#include <connection.hpp>
#include <database.hpp>
#include <databasedriver.hpp>
#include <result.hpp>

namespace lighthouse::testing {

class MockConnection final : public ::db::IConnection {
public:
  MOCK_METHOD(bool, isHealthy, (), (const, override));
  MOCK_METHOD(void, close, (), (override));
};

class MockDatabase final : public ::db::IDatabase {
public:
  using ConnectResult = ::db::Result<std::unique_ptr<::db::IConnection>>;

  MOCK_METHOD(ConnectResult, connect, (), (override));
};

class MockDatabaseDriver final : public ::db::IDatabaseDriver {
public:
  using OpenResult = ::db::Result<std::unique_ptr<::db::IDatabase>>;

  MOCK_METHOD(OpenResult, open, (const ::db::DatabaseConfig &config),
              (override));
};

} // namespace lighthouse::testing
