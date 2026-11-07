cmake_minimum_required(VERSION 3.2)

project(lighthouse_scripts)

add_executable(lighthouse_test_repl lighthouse_test_repl.cpp)

lighthouse_set_project_warnings(lighthouse_test_repl)

target_link_libraries(lighthouse_test_repl
  PRIVATE
    db_engine_lib
)

