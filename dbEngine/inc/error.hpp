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

    // Useful for debugging driver-specific errors.
    std::string nativeCode;
};

}
