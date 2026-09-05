cmake_minimum_required(VERSION 4.4)

project(db_engine)

add_library(db_engine_lib)

lighthouse_set_project_warnings(db_engine_lib)

file(GLOB_RECURSE DBENGINE_HEADERS
    CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/inc/*.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/inc/*.hpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/sqlite/inc/*.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/sqlite/inc/*.hpp"
)

target_sources(db_engine_lib
  PRIVATE
    src/main.cpp
    sqlite/src/SqliteDataBase.cpp
    sqlite/src/SqliteDatabaseDriver.cpp

  PUBLIC
    FILE_SET HEADERS
	BASE_DIRS
	  inc
    sqlite/inc
	FILES
    ${DBENGINE_HEADERS}
)

target_compile_features(db_engine_lib 
  PUBLIC
  cxx_std_23
)

find_package(SQLite3 REQUIRED)

target_link_libraries(db_engine_lib
  PRIVATE
    SQLite3::SQLite3
)

set_target_properties(db_engine_lib PROPERTIES
    COMPILE_WARNING_AS_ERROR ON
)

if(RUN_TESTS)
  return()
endif()

add_executable(test)

target_sources(test
  PRIVATE
  sqlite/test.cpp
)

target_link_libraries(test
  PRIVATE
  db_engine_lib
)

target_compile_features(test
  PRIVATE # Should be public if needs cstd in shared header files
  cxx_std_23
)
