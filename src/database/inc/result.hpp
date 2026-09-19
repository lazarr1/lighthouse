#pragma once

#include <expected>
#include <future>
#include <optional>
#include <string>

namespace db {

enum class DbErrorCode { 
  NoError = 0, 
  NotImplemented,

  FailedToOpenDatabase,
  UnkownOpenType,

  UnableToStartTransaction,
  UnknownTransactionType, 
  NoTransactionPresent,
  TransactionAlreadyStarted,
};

struct DbError {
  DbError(const DbErrorCode ec);
  DbError(const DbErrorCode ec, const int nativeErrorCode, const std::string message);
  DbErrorCode ec;
  bool isNativeError;
  std::optional<int> nativeErrorCode;
  std::optional<std::string> message;
};

template <typename T> using Result = std::expected<T, DbError>;

template <typename T> using AsyncResult = std::future<Result<T>>;

}; // namespace db
