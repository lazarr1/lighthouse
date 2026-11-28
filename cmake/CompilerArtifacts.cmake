# Opt-in compiler/linker artifacts for inspecting generated code.
#
#   cmake --preset artifacts && cmake --build --preset artifacts
#
# Per translation unit (next to each .o under CMakeFiles/<target>.dir/<config>/):
#   *.ii  preprocessed source      *.s        assembly, debug info stripped
#   *.bc  LLVM bitcode             *.debug.s  assembly as emitted, with DWARF
#   *.su  per-function stack usage
# Per linked binary (next to the executable/library):
#   <binary>.map  linker map: every symbol, its address, size and source object
# Call graph (needs Homebrew LLVM + graphviz):
#   cmake --build --preset artifacts --target <target>_callgraph
#   -> <build>/callgraphs/<config>/<target>.{dot,svg}

# Captured at include time; inside the function CMAKE_CURRENT_LIST_DIR would be the caller's.
set(_LIGHTHOUSE_ARTIFACTS_DIR "${CMAKE_CURRENT_LIST_DIR}")

option(LIGHTHOUSE_EMIT_ARTIFACTS
  "Keep .ii/.s/.bc/.su files, linker maps, and add <target>_callgraph targets" OFF)

if(LIGHTHOUSE_EMIT_ARTIFACTS)
  find_program(LIGHTHOUSE_LLVM_LINK llvm-link HINTS /opt/homebrew/opt/llvm/bin /usr/local/opt/llvm/bin)
  find_program(LIGHTHOUSE_LLVM_OPT opt HINTS /opt/homebrew/opt/llvm/bin /usr/local/opt/llvm/bin)
  find_program(LIGHTHOUSE_LLVM_CXXFILT llvm-cxxfilt HINTS /opt/homebrew/opt/llvm/bin /usr/local/opt/llvm/bin)
  find_program(LIGHTHOUSE_DOT dot)
  find_package(Python3 COMPONENTS Interpreter)
endif()

# Call graph node filter (regex on demangled names). Everything else, mostly
# std::, is dropped, but edges through dropped nodes are not preserved.
set(LIGHTHOUSE_CALLGRAPH_FILTER "^(db::[^ (]*\\(|main$)" CACHE STRING
  "Regex selecting which demangled functions appear in call graphs")

function(lighthouse_emit_artifacts target)
  if(NOT LIGHTHOUSE_EMIT_ARTIFACTS)
    return()
  endif()
  if(NOT CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    message(WARNING "LIGHTHOUSE_EMIT_ARTIFACTS: unsupported compiler, skipping ${target}")
    return()
  endif()

  # -save-temps=obj writes the intermediates next to the object file.
  target_compile_options(${target} PRIVATE -save-temps=obj -fverbose-asm -fstack-usage)

  # Split each foo.s into a lean foo.s and the original foo.debug.s.
  if(Python3_Interpreter_FOUND)
    add_custom_command(TARGET ${target} POST_BUILD
      COMMAND "${Python3_EXECUTABLE}" "${_LIGHTHOUSE_ARTIFACTS_DIR}/tools/strip_asm_debug.py"
        "$<TARGET_OBJECTS:${target}>"
      COMMAND_EXPAND_LISTS
      VERBATIM
    )
  endif()

  get_target_property(type ${target} TYPE)
  if(type MATCHES "EXECUTABLE|SHARED_LIBRARY|MODULE_LIBRARY")
    set(map "$<TARGET_FILE_DIR:${target}>/$<TARGET_FILE_NAME:${target}>.map")
    if(APPLE)
      target_link_options(${target} PRIVATE "LINKER:-map,${map}")
    else()
      target_link_options(${target} PRIVATE "LINKER:-Map=${map}")
    endif()
  endif()

  # Deferred to the end of configure so target_link_libraries() calls made
  # after this one are visible. EVAL bakes in ${target} now; DEFER alone would
  # expand it later, when the variable no longer exists.
  cmake_language(EVAL CODE "
    cmake_language(DEFER DIRECTORY [[${CMAKE_SOURCE_DIR}]]
      CALL _lighthouse_add_callgraph [[${target}]])")
endfunction()

function(_lighthouse_add_callgraph target)
  if(NOT (LIGHTHOUSE_LLVM_LINK AND LIGHTHOUSE_LLVM_OPT AND LIGHTHOUSE_LLVM_CXXFILT
          AND Python3_Interpreter_FOUND AND CMAKE_CXX_COMPILER_ID MATCHES "Clang"))
    message(STATUS "Call graph for ${target} unavailable (needs clang + `brew install llvm`)")
    return()
  endif()

  # Bitcode of this target plus any linked project libraries that also emit it.
  set(objects "$<TARGET_OBJECTS:${target}>")
  get_target_property(deps ${target} LINK_LIBRARIES)
  foreach(dep IN LISTS deps)
    if(TARGET ${dep})
      get_target_property(dep_type ${dep} TYPE)
      if(dep_type MATCHES "STATIC_LIBRARY|SHARED_LIBRARY|OBJECT_LIBRARY")
        list(APPEND objects "$<TARGET_OBJECTS:${dep}>")
      endif()
    endif()
  endforeach()

  set(out_dir "${CMAKE_BINARY_DIR}/callgraphs/$<CONFIG>")
  add_custom_target(${target}_callgraph
    COMMAND "${Python3_EXECUTABLE}" "${_LIGHTHOUSE_ARTIFACTS_DIR}/tools/callgraph.py"
      --llvm-link "${LIGHTHOUSE_LLVM_LINK}"
      --opt "${LIGHTHOUSE_LLVM_OPT}"
      --cxxfilt "${LIGHTHOUSE_LLVM_CXXFILT}"
      --dot "${LIGHTHOUSE_DOT}"
      --filter "${LIGHTHOUSE_CALLGRAPH_FILTER}"
      --out "${out_dir}/${target}"
      "${objects}"
    DEPENDS ${target}
    COMMAND_EXPAND_LISTS
    VERBATIM
    COMMENT "Generating call graph for ${target}"
  )
endfunction()
