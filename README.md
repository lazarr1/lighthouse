# Lighthouse

## Prerequisites

- CMake 4.4 or newer
- Ninja
- A C++23 compiler
- Boost 1.80 or newer
- SQLite 3 development headers and library
- Git and network access during the first configure
- Clang, `llvm-profdata`, and `llvm-cov` for coverage reports

## Build

The default preset keeps tests disabled and builds the existing project:

```sh
cmake --preset default
cmake --build --preset default
```

## Build and run tests

Tests use a separate build directory. The test build preset compiles and runs
all unit, integration, and public-header tests without generating coverage:

```sh
cmake --preset tests
cmake --build --preset tests
```

Unit tests must not use the filesystem, network, SQLite, or other external
services. Integration tests may use real adapters, but must own their resources
and clean them up. The SQLite fixture creates unique directories under the
operating system's temporary directory, making tests parallel-safe and keeping
the repository clean.

## Coverage reports

Coverage remains an explicit target and is not run by either build preset:

```sh
cmake --preset tests -DLIGHTHOUSE_ENABLE_COVERAGE=ON
cmake --build build/tests --config Debug --target coverage
```

The command prints a summary and writes the HTML report to
`build/tests/reports/coverage/html/index.html`. It replaces the previous
report each time. The default preset also produces `build/compile_commands.json`
for clangd-compatible language servers.

## Writing tests

Test code is separate from production code:

```text
tests/
  unit/database/
  integration/database/sqlite/
  support/include/lighthouse/testing/
```

Register another test executable in `tests/CMakeLists.txt`:

```cmake
lighthouse_add_gtest(
  lighthouse_example_unit_tests
  unit
  unit/example/example_test.cpp
)
target_link_libraries(lighthouse_example_unit_tests PRIVATE db_engine_lib)
```

The helper supplies `GTest::gmock_main`, discovers each GoogleTest case through
CTest, and adds either the `unit` or `integration` label. Test files do not need
a custom `main()`.

Reusable DB mocks are available with:

```cpp
#include <lighthouse/testing/db_mocks.hpp>

lighthouse::testing::MockDatabaseDriver driver;
```

Mock interfaces owned by Lighthouse, such as `IDatabaseDriver`. Exercise
concrete third-party adapters, such as the SQLite driver, against the real
dependency in integration tests rather than mocking the SQLite C API.

## Adding a module

1. Define a narrow project-owned interface that application code can depend on.
2. Build concrete provider code as a separate library target.
3. Put reusable GoogleMock implementations under `tests/support`.
4. Add deterministic unit tests for consumers of the interface.
5. Add separately labeled integration tests for the real provider or adapter.
6. Keep credentials, network access, and persistent files out of unit tests.

No CI or sanitizer workflow is configured yet; testing and coverage are local.
