find_package(nlohmann_json 3.12.0 REQUIRED)
find_package(cpp-httplib 0.67.0 REQUIRED)

add_executable(test ollama_test.cpp)

target_link_libraries(test
  PRIVATE
  nlohmann_json::nlohmann_json
  cpp-httplib::cpp-httplib
)
