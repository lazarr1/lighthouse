cmake_minimum_required(VERSION 4.4)

project(lighthouse)

# Root CMakeLists.txt
option(LIGHTHOUSE_WARNINGS_AS_ERRORS "Treat project warnings as errors" ON)

include(cmake/ProjectWarnings.cmake)

add_subdirectory(src/database)

option(RUN_TESTS "Run and build tests" 0)
if(RUN_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()
