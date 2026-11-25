#pragma once

#include <memory>

#include <gmock/gmock.h>

#include <i_database.hpp>
#include <i_connection.hpp>

namespace lighthouse::testing {

class MockConnection final : public ::db::iConnection {
 public:
  MOCK_METHOD(::db::Result<void>, beginTransaction,
              (::db::TransactionMode mode), (override));
  MOCK_METHOD(::db::Result<void>, commit, (), (override));
  MOCK_METHOD(::db::Result<void>, rollback, (), (override));
};

class MockDatabase final : public ::db::iDatabase {
 public:
  using OpenResult = ::db::Result<std::unique_ptr<::db::iConnection>>;

  MOCK_METHOD(OpenResult, open, (), (const, override));
  MOCK_METHOD(const ::db::Capabilities, getCapabilities, (), (const, override));
};

} // namespace lighthouse::testing
