if(NOT DEFINED PROFILE_DIRECTORY)
  message(FATAL_ERROR "PROFILE_DIRECTORY is required")
endif()
if(NOT DEFINED OUTPUT_PROFILE)
  message(FATAL_ERROR "OUTPUT_PROFILE is required")
endif()
if(NOT DEFINED LLVM_PROFDATA_EXECUTABLE)
  message(FATAL_ERROR "LLVM_PROFDATA_EXECUTABLE is required")
endif()

file(
  GLOB raw_profiles
  LIST_DIRECTORIES FALSE
  "${PROFILE_DIRECTORY}/*.profraw"
)

if(NOT raw_profiles)
  message(FATAL_ERROR "No raw coverage profiles found in ${PROFILE_DIRECTORY}")
endif()

execute_process(
  COMMAND
    "${LLVM_PROFDATA_EXECUTABLE}" merge
    -sparse
    ${raw_profiles}
    -o "${OUTPUT_PROFILE}"
  COMMAND_ERROR_IS_FATAL ANY
)
