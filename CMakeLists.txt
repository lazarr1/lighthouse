cmake_minimum_required(VERSION 4.4)

project(lighthouse)

#
# Libraries
#

add_library(lighthouse)

target_sources(lighthouse
  PRIVATE
    src/lighthouse.cpp

  PUBLIC
    FILE_SET HEADERS
	BASE_DIRS
	  inc
	FILES
	  inc/lighthouse.hpp
)

target_compile_features(lighthouse 
  PRIVATE # Should be public if needs cstd in shared header files
  cxx_std_23
)

set_target_properties(lighthouse PROPERTIES
    COMPILE_WARNING_AS_ERROR ON
)

# target_compile_options(lighthouse PRIVATE -Wall -Werror)

#
# External dependencies
#
include(FetchContent)
FetchContent_Declare(WsDispatcher
  GIT_REPOSITORY https://github.com/lazarr1/ws-dispatcher.git
  GIT_TAG v1.0.2
)

FetchContent_MakeAvailable(WsDispatcher)

FIND_PACKAGE( Boost 1.80 COMPONENTS program_options REQUIRED )

#
# Executables
#

add_executable(main)

target_sources(main
  PRIVATE
    main.cpp
)

target_link_libraries(main
  PRIVATE
    lighthouse
	WsDispatcher
	${Boost_LIBRARIES}
)

target_compile_features(main 
  PRIVATE
  cxx_std_23
)

set_target_properties(main PROPERTIES
    COMPILE_WARNING_AS_ERROR ON
)

# BAD: GNU Specific:
# target_compile_options(main PRIVATE -Wall -Werror)

add_subdirectory(dbEngine)

option(RUN_TESTS "Run and build tests" 0)
if(RUN_TESTS) 
  add_subdirectory(tests)
endif()
