#pragma once

#include <future>
#include <string>
#include <expected>

enum class DbErrorCode {
  NotImplemented
};

struct DbError {
  DbErrorCode ec;
  std::string message;
};

template<typename T>
using Result = std::expected<T, DbError>;

template<typename T>
using AsyncResult = std::future<Result<T>>;

