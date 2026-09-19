#pragma once

#include <memory>

#include <gmock/gmock.h>

#include <i_database_adapter.hpp>
#include <i_database_session.hpp>

namespace lighthouse::testing {

class MockDatabaseSession final : public ::db::iDatabaseSession {
 public:
  MOCK_METHOD(::db::Result<void>, beginTransaction,
              (::db::TransactionMode mode), (override));
  MOCK_METHOD(::db::Result<void>, commit, (), (override));
  MOCK_METHOD(::db::Result<void>, rollback, (), (override));
};

class MockDatabaseAdapter final : public ::db::iDatabaseAdapter {
 public:
  using OpenResult = ::db::Result<std::unique_ptr<::db::iDatabaseSession>>;

  MOCK_METHOD(OpenResult, open, (), (const, override));
  MOCK_METHOD(const ::db::Capabilities, getCapabilities, (), (const, override));
};

} // namespace lighthouse::testing
