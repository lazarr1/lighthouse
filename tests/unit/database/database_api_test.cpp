#include <memory>
#include <utility>

#include <gmock/gmock.h>
#include <gtest/gtest.h>

#include <lighthouse/testing/db_mocks.hpp>

namespace {

using ::testing::ByMove;
using ::testing::Return;

TEST(DatabaseAdapterApiTest, OpensSessionThroughAdapterContract) {
  lighthouse::testing::MockDatabaseAdapter adapter;
  auto session = std::make_unique<lighthouse::testing::MockDatabaseSession>();
  auto *const session_mock = session.get();

  EXPECT_CALL(adapter, open())
      .WillOnce(Return(ByMove(db::Result<std::unique_ptr<db::iDatabaseSession>>{
          std::move(session)})));

  db::iDatabaseAdapter &database_adapter = adapter;
  auto opened_session = database_adapter.open();

  ASSERT_TRUE(opened_session.has_value());
  EXPECT_EQ(opened_session->get(), session_mock);
}

TEST(DatabaseSessionApiTest, DispatchesTransactionOperationsThroughSessionContract) {
  lighthouse::testing::MockDatabaseSession session;
  const db::Result<void> success{};

  EXPECT_CALL(session, beginTransaction(db::TransactionMode::ReadWrite))
      .WillOnce(Return(success));
  EXPECT_CALL(session, commit()).WillOnce(Return(success));
  EXPECT_CALL(session, rollback()).WillOnce(Return(success));

  db::iDatabaseSession &database_session = session;

  EXPECT_TRUE(database_session
                  .beginTransaction(db::TransactionMode::ReadWrite)
                  .has_value());
  EXPECT_TRUE(database_session.commit().has_value());
  EXPECT_TRUE(database_session.rollback().has_value());
}

} // namespace
