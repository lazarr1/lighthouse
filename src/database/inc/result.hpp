#pragma once

#include <expected>
#include <optional>
#include <string>

namespace db {

enum class DbErrorCode {
  NotImplemented,

  FailedToOpenDatabase,
  UnknownOpenType,
  CommandFailed,

  UnableToStartTransaction,
  UnknownTransactionType,
  NoTransactionPresent,
  TransactionAlreadyStarted,
};

struct DbError {
  DbError(const DbErrorCode ec);
  DbError(const DbErrorCode ec, const int nativeErrorCode,
          const std::string message);
  DbErrorCode ec;
  bool isNativeError;
  std::optional<int> nativeErrorCode;
  std::optional<std::string> message;
};

template <typename T> using Result = std::expected<T, DbError>;

}; // namespace db
