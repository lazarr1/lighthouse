#include <memory>

#include <gtest/gtest.h>

#include "sqlite_database_adapter.hpp"

namespace {

std::unique_ptr<db::iDatabaseSession> openInMemorySession() {
  db::SqliteDatabaseAdapter adapter(
      {.path = ":memory:", .openMode = db::OpenMode::ReadWriteCreate});
  auto session = adapter.open();

  EXPECT_TRUE(session.has_value());
  return session ? std::move(*session) : nullptr;
}

TEST(SqliteDatabaseAdapterTest, OpensInMemorySession) {
  auto session = openInMemorySession();

  ASSERT_NE(session, nullptr);
}

TEST(SqliteDatabaseSessionTest, BeginsReadWriteTransactionAndCommits) {
  auto session = openInMemorySession();
  ASSERT_NE(session, nullptr);

  EXPECT_TRUE(session->beginTransaction(db::TransactionMode::ReadWrite).has_value());
  EXPECT_TRUE(session->commit().has_value());
}

TEST(SqliteDatabaseSessionTest, BeginsReadOnlyTransactionAndRollsBack) {
  auto session = openInMemorySession();
  ASSERT_NE(session, nullptr);

  EXPECT_TRUE(session->beginTransaction(db::TransactionMode::ReadOnly).has_value());
  EXPECT_TRUE(session->rollback().has_value());
}

TEST(SqliteDatabaseSessionTest, RejectsSecondTransactionWhileOneIsActive) {
  auto session = openInMemorySession();
  ASSERT_NE(session, nullptr);
  ASSERT_TRUE(session->beginTransaction(db::TransactionMode::ReadOnly).has_value());

  const auto result = session->beginTransaction(db::TransactionMode::ReadWrite);

  ASSERT_FALSE(result.has_value());
  EXPECT_EQ(result.error().ec, db::DbErrorCode::TransactionAlreadyStarted);
  EXPECT_TRUE(session->rollback().has_value());
}

TEST(SqliteDatabaseSessionTest, RejectsCommitAndRollbackWithoutTransaction) {
  auto session = openInMemorySession();
  ASSERT_NE(session, nullptr);

  const auto commit = session->commit();
  const auto rollback = session->rollback();

  ASSERT_FALSE(commit.has_value());
  EXPECT_EQ(commit.error().ec, db::DbErrorCode::NoTransactionPresent);
  ASSERT_FALSE(rollback.has_value());
  EXPECT_EQ(rollback.error().ec, db::DbErrorCode::NoTransactionPresent);
}

TEST(SqliteDatabaseSessionTest, RejectsInvalidTransactionMode) {
  auto session = openInMemorySession();
  ASSERT_NE(session, nullptr);

  const auto result =
      session->beginTransaction(static_cast<db::TransactionMode>(-1));

  ASSERT_FALSE(result.has_value());
  EXPECT_EQ(result.error().ec, db::DbErrorCode::UnknownTransactionType);
}

TEST(SqliteDatabaseSessionTest, ResetsTransactionStateAfterCommitAndRollback) {
  auto session = openInMemorySession();
  ASSERT_NE(session, nullptr);

  ASSERT_TRUE(session->beginTransaction(db::TransactionMode::ReadWrite).has_value());
  ASSERT_TRUE(session->commit().has_value());
  ASSERT_TRUE(session->beginTransaction(db::TransactionMode::ReadOnly).has_value());
  EXPECT_TRUE(session->rollback().has_value());
}

} // namespace
