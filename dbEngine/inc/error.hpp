#pragma once

#include <string>

namespace db {

enum class ErrorCode {
  ConnectionFailed,
  InvalidQuery,
  Timeout,
  Unsupported,
  Unknown
};

struct Error {
  ErrorCode code;
  std::string message;
  std::string driver;

  // Useful for debugging driver-specific errors.
  std::string nativeError;
};

} // namespace db
