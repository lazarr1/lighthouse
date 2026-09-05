cmake_minimum_required(VERSION 3.2)

project(db_engine)

file(GLOB_RECURSE DBENGINE_CONTRACT_HEADERS
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/inc/*.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/inc/*.hpp"
)

file(GLOB_RECURSE DBENGINE_SQLITE_HEADERS
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/sqlite/*.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/sqlite/*.hpp"
)

add_library(db_engine_contracts INTERFACE)
target_sources(
  db_engine_contracts
  INTERFACE
    FILE_SET HEADERS
    BASE_DIRS inc
    FILES ${DBENGINE_CONTRACT_HEADERS}
)
target_compile_features(db_engine_contracts INTERFACE cxx_std_23)

add_library(db_engine_lib)

lighthouse_set_project_warnings(db_engine_lib)

target_sources(db_engine_lib
  PRIVATE
    src/test.cpp

  PUBLIC
    FILE_SET HEADERS
    BASE_DIRS sqlite
    FILES ${DBENGINE_SQLITE_HEADERS}
)

target_compile_features(db_engine_lib 
  PUBLIC
  cxx_std_23
)

find_package(SQLite3 REQUIRED)

target_link_libraries(db_engine_lib
  PUBLIC
    db_engine_contracts
  PRIVATE
    SQLite3::SQLite3
)

set_target_properties(db_engine_lib PROPERTIES
    COMPILE_WARNING_AS_ERROR ON
)

