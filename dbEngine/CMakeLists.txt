cmake_minimum_required(VERSION 4.4)

project(dbManager)


add_executable(test)

target_sources(test
  PRIVATE
  sqlite/test.cpp
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
