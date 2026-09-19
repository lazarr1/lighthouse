#include "result.hpp"

namespace db { 

DbError::DbError(const DbErrorCode ec)
  : ec(ec), isNativeError(false), nativeErrorCode(std::nullopt), message(std::nullopt)
{

}

DbError::DbError(const DbErrorCode ec, const int nativeErrorCode, const std::string message)
 : ec(ec), isNativeError(true), nativeErrorCode(nativeErrorCode), message(message)
{

}

};
