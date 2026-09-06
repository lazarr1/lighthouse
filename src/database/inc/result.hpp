#pragma once

#include <future>
#include <string>
#include <expected>


namespace db {

enum class DbErrorCode {
  FailedToOpenDatabase,
  NotImplemented
};

struct DbError {
  DbErrorCode ec;
  int nativeEc;
  std::string message;
};

template<typename T>
using Result = std::expected<T, DbError>;

template<typename T>
using AsyncResult = std::future<Result<T>>;

};
