#include <memory>

#include <gtest/gtest.h>

#include "sqlite_database.hpp"

namespace {

std::unique_ptr<db::iConnection> openInMemoryConnection() {
  db::SqliteDatabase database(
      {.path = ":memory:", .openMode = db::OpenMode::ReadWriteCreate});
  auto connection = database.open();

  EXPECT_TRUE(connection.has_value());
  return connection ? std::move(*connection) : nullptr;
}

TEST(SqliteDatabaseTest, OpensInMemoryConnection) {
  auto connection = openInMemoryConnection();

  ASSERT_NE(connection, nullptr);
}

TEST(SqliteConnectionTest, BeginsReadWriteTransactionAndCommits) {
  auto connection = openInMemoryConnection();
  ASSERT_NE(connection, nullptr);

  EXPECT_TRUE(connection->beginTransaction(db::TransactionMode::ReadWrite).has_value());
  EXPECT_TRUE(connection->commit().has_value());
}

TEST(SqliteConnectionTest, BeginsReadOnlyTransactionAndRollsBack) {
  auto connection = openInMemoryConnection();
  ASSERT_NE(connection, nullptr);

  EXPECT_TRUE(connection->beginTransaction(db::TransactionMode::ReadOnly).has_value());
  EXPECT_TRUE(connection->rollback().has_value());
}

TEST(SqliteConnectionTest, RejectsSecondTransactionWhileOneIsActive) {
  auto connection = openInMemoryConnection();
  ASSERT_NE(connection, nullptr);
  ASSERT_TRUE(connection->beginTransaction(db::TransactionMode::ReadOnly).has_value());

  const auto result = connection->beginTransaction(db::TransactionMode::ReadWrite);

  ASSERT_FALSE(result.has_value());
  EXPECT_EQ(result.error().ec, db::DbErrorCode::TransactionAlreadyStarted);
  EXPECT_TRUE(connection->rollback().has_value());
}

TEST(SqliteConnectionTest, RejectsCommitAndRollbackWithoutTransaction) {
  auto connection = openInMemoryConnection();
  ASSERT_NE(connection, nullptr);

  const auto commit = connection->commit();
  const auto rollback = connection->rollback();

  ASSERT_FALSE(commit.has_value());
  EXPECT_EQ(commit.error().ec, db::DbErrorCode::NoTransactionPresent);
  ASSERT_FALSE(rollback.has_value());
  EXPECT_EQ(rollback.error().ec, db::DbErrorCode::NoTransactionPresent);
}

TEST(SqliteConnectionTest, RejectsInvalidTransactionMode) {
  auto connection = openInMemoryConnection();
  ASSERT_NE(connection, nullptr);

  const auto result =
      connection->beginTransaction(static_cast<db::TransactionMode>(-1));

  ASSERT_FALSE(result.has_value());
  EXPECT_EQ(result.error().ec, db::DbErrorCode::UnknownTransactionType);
}

TEST(SqliteConnectionTest, ResetsTransactionStateAfterCommitAndRollback) {
  auto connection = openInMemoryConnection();
  ASSERT_NE(connection, nullptr);

  ASSERT_TRUE(connection->beginTransaction(db::TransactionMode::ReadWrite).has_value());
  ASSERT_TRUE(connection->commit().has_value());
  ASSERT_TRUE(connection->beginTransaction(db::TransactionMode::ReadOnly).has_value());
  EXPECT_TRUE(connection->rollback().has_value());
}

TEST(SqliteConnectionTest, ExecutesCommandsAndReturnsResultRows) {
  auto connection = openInMemoryConnection();
  ASSERT_NE(connection, nullptr);

  EXPECT_TRUE(
      connection->execute({.command = "CREATE TABLE data (id INTEGER, name TEXT);"}).has_value());
  EXPECT_TRUE(connection->execute({.command = "INSERT INTO data VALUES (7, 'Ada');"}).has_value());

  const auto result = connection->execute({.command = "SELECT id, name FROM data;"});
  ASSERT_TRUE(result.has_value());
  const auto &page = *result;
  ASSERT_EQ(page.columns.size(), 2U);
  ASSERT_EQ(page.rows.size(), 1U);
  EXPECT_EQ(std::get<std::int64_t>(page.rows[0].values[0]), 7);
  EXPECT_EQ(std::get<std::string>(page.rows[0].values[1]), "Ada");
}

TEST(SqliteConnectionTest, ReportsInvalidCommands) {
  auto connection = openInMemoryConnection();
  ASSERT_NE(connection, nullptr);

  const auto result = connection->execute({.command = "not valid sql"});

  ASSERT_FALSE(result.has_value());
  EXPECT_EQ(result.error().ec, db::DbErrorCode::CommandFailed);
  EXPECT_TRUE(result.error().isNativeError);
}

} // namespace
