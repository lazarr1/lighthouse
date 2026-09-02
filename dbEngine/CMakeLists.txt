cmake_minimum_required(VERSION 4.4)

project(db_engine)

add_library(db_engine_lib)

file(GLOB_RECURSE DBENGINE_HEADERS
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/inc/*.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/inc/*.hpp"
)

target_sources(db_engine_lib
  PRIVATE
    src/main.cpp

  PUBLIC
    FILE_SET HEADERS
	BASE_DIRS
	  inc
	FILES
    ${DBENGINE_HEADERS}
)

target_compile_features(db_engine_lib 
  PRIVATE # Should be public if needs cstd in shared header files
  cxx_std_23
)

set_target_properties(db_engine_lib PROPERTIES
    COMPILE_WARNING_AS_ERROR ON
)

add_executable(test)

target_sources(test
  PRIVATE
  sqlite/test.cpp
)

target_link_libraries(test
  PRIVATE
  db_engine_lib
)

find_package(SQLite3 REQUIRED)

target_link_libraries(test
  PRIVATE
  SQLite3::SQLite3
)

target_compile_features(test
  PRIVATE # Should be public if needs cstd in shared header files
  cxx_std_23
)
