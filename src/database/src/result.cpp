#include "result.hpp"
#include <bit>



namespace db { 

DbError::DbError(const DbErrorCode ec) 
  : ec(ec), isNativeError(false)
{

}

DbError::DbError(const DbErrorCode ec, const int nativeErrorCode, const std::string message)
 : ec(ec), isNativeError(true), nativeErrorCode(nativeErrorCode), message(message)
{

}

};
