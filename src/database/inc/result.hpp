#pragma once

#include <expected>
#include <future>
#include <string>

namespace db {

enum class DbErrorCode { NoError = 0, FailedToOpenDatabase, UnknownTransactionType, UnableToStartTransaction, NotImplemented };

struct DbError {
  DbError(const DbErrorCode ec);
  DbError(const DbErrorCode ec, const int nativeErrorCode, const std::string message);
  DbErrorCode ec;
  bool isNativeError;
  int nativeErrorCode;
  std::string message;
};

template <typename T> using Result = std::expected<T, DbError>;

template <typename T> using AsyncResult = std::future<Result<T>>;

}; // namespace db
