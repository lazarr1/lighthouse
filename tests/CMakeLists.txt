include(FetchContent)

option(LIGHTHOUSE_ENABLE_COVERAGE "Enable Clang source-based coverage" OFF)

if(LIGHTHOUSE_ENABLE_COVERAGE)
  if(NOT CMAKE_CXX_COMPILER_ID MATCHES "Clang")
    message(FATAL_ERROR "Coverage builds require Clang or AppleClang")
  endif()

  find_program(LIGHTHOUSE_LLVM_COV NAMES llvm-cov REQUIRED)
  find_program(LIGHTHOUSE_LLVM_PROFDATA NAMES llvm-profdata REQUIRED)

  function(lighthouse_instrument_for_coverage target)
    target_compile_options(
      ${target}
      PRIVATE
        -fprofile-instr-generate
        -fcoverage-mapping
    )

    get_target_property(target_type ${target} TYPE)
    if(target_type STREQUAL "EXECUTABLE")
      target_link_options(${target} PRIVATE -fprofile-instr-generate)
    endif()
  endfunction()
endif()

set(INSTALL_GTEST OFF CACHE BOOL "" FORCE)
if(MSVC)
  set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
endif()

FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.18.0
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(googletest)

include(GoogleTest)

function(lighthouse_add_gtest target test_type)
  add_executable(${target} ${ARGN})
  target_link_libraries(${target} PRIVATE GTest::gmock_main)
  target_compile_features(${target} PRIVATE cxx_std_23)
  set_target_properties(
    ${target}
    PROPERTIES
      COMPILE_WARNING_AS_ERROR ON
      CXX_EXTENSIONS OFF
  )
  if(LIGHTHOUSE_ENABLE_COVERAGE)
    lighthouse_instrument_for_coverage(${target})
  endif()
  gtest_discover_tests(
    ${target}
    TEST_PREFIX "${test_type}."
    PROPERTIES LABELS "${test_type}"
    DISCOVERY_TIMEOUT 30
    DISCOVERY_MODE PRE_TEST
  )
endfunction()

add_library(lighthouse_test_support INTERFACE)
target_sources(
  lighthouse_test_support
  INTERFACE
    FILE_SET HEADERS
    BASE_DIRS support/include
    FILES support/include/lighthouse/testing/db_mocks.hpp
)
target_link_libraries(
  lighthouse_test_support
  INTERFACE
    GTest::gmock
    db_engine_contracts
)

# Compile every public database header as the only include in its translation
# unit. This catches missing includes without changing the production CMake.
set_property(TARGET db_engine_contracts PROPERTY VERIFY_INTERFACE_HEADER_SETS ON)
set_property(TARGET db_engine_lib PROPERTY VERIFY_INTERFACE_HEADER_SETS ON)
add_custom_target(lighthouse_public_header_tests ALL)
add_dependencies(
  lighthouse_public_header_tests
  db_engine_contracts_verify_interface_header_sets
  db_engine_lib_verify_interface_header_sets
)

lighthouse_add_gtest(
  lighthouse_integration_tests
  integration
  integration/database/sqlite/sqlite_database_driver_test.cpp
)
target_link_libraries(lighthouse_integration_tests PRIVATE db_engine_lib)

# When a unit-test is added uncomment this line
# lighthouse_add_gtest(
#   lighthouse_unit_tests
#   unit
#   unit/database/your_real_unit_test.cpp
# )
# target_link_libraries(lighthouse_unit_tests PRIVATE lighthouse_test_support)

# convenience target that automatically runs the tests as part of build
add_custom_target(
  lighthouse_tests
  COMMAND
    ${CMAKE_CTEST_COMMAND}
    --test-dir "${PROJECT_BINARY_DIR}"
    -C $<CONFIG>
    --output-on-failure
  DEPENDS
    lighthouse_public_header_tests
    lighthouse_integration_tests
  USES_TERMINAL
  VERBATIM
)

if(LIGHTHOUSE_ENABLE_COVERAGE)
  lighthouse_instrument_for_coverage(db_engine_lib)

  set(report_directory "${CMAKE_BINARY_DIR}/reports/coverage")
  set(raw_profile_directory "${report_directory}/raw")
  set(indexed_profile "${report_directory}/coverage.profdata")

  add_custom_target(
    coverage
    COMMAND ${CMAKE_COMMAND} -E rm -rf "${report_directory}"
    COMMAND ${CMAKE_COMMAND} -E make_directory "${raw_profile_directory}"
    COMMAND
      ${CMAKE_COMMAND} -E env
      "LLVM_PROFILE_FILE=${raw_profile_directory}/%m.profraw"
      ${CMAKE_CTEST_COMMAND}
      --test-dir "${PROJECT_BINARY_DIR}"
      -C $<CONFIG>
      --output-on-failure
    COMMAND
      ${CMAKE_COMMAND}
      "-DPROFILE_DIRECTORY=${raw_profile_directory}"
      "-DOUTPUT_PROFILE=${indexed_profile}"
      "-DLLVM_PROFDATA_EXECUTABLE=${LIGHTHOUSE_LLVM_PROFDATA}"
      -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/MergeCoverageProfiles.cmake"
    COMMAND
      ${LIGHTHOUSE_LLVM_COV} show
      "$<TARGET_FILE:lighthouse_integration_tests>"
      "-instr-profile=${indexed_profile}"
      "-include-filename-regex=^${PROJECT_SOURCE_DIR}/src/"
      -format=html
      -show-directory-coverage
      "-output-dir=${report_directory}/html"
    COMMAND
      ${LIGHTHOUSE_LLVM_COV} report
      "$<TARGET_FILE:lighthouse_integration_tests>"
      "-instr-profile=${indexed_profile}"
      "-include-filename-regex=^${PROJECT_SOURCE_DIR}/src/"
    COMMAND
      ${CMAKE_COMMAND} -E echo
      "Coverage report: ${report_directory}/html/index.html"
    DEPENDS
      lighthouse_integration_tests
    USES_TERMINAL
    VERBATIM
  )
endif()
