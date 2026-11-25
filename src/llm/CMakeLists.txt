include(FetchContent)

FetchContent_Declare(nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG        v3.12.0
  GIT_SHALLOW    TRUE
)

FetchContent_MakeAvailable(nlohmann_json)

FetchContent_Declare(cpp-httplib
  GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
  GIT_TAG        v0.67.0
  GIT_SHALLOW    TRUE
)

FetchContent_MakeAvailable(cpp-httplib)

add_executable(test ollama_test.cpp)

target_link_libraries(test
  PRIVATE
  nlohmann_json::nlohmann_json
  httplib::httplib
)
