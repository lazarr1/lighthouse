#pragma once

#include <expected>
#include <future>
#include <string>

namespace db {

enum class DbErrorCode { FailedToOpenDatabase, NotImplemented };

struct DbError {
  DbErrorCode ec;
  int nativeErrorCode;
  std::string message;
};

template <typename T> using Result = std::expected<T, DbError>;

template <typename T> using AsyncResult = std::future<Result<T>>;

}; // namespace db
