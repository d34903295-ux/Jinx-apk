cmake_minimum_required(VERSION 3.22.1)
project(nodo-llama)

set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(LLAMA_NATIVE OFF CACHE BOOL "" FORCE)

add_subdirectory(
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../third_party/llama.cpp
    ${CMAKE_BINARY_DIR}/llama.cpp-build)

add_library(native-lib SHARED native-lib.cpp)

target_include_directories(native-lib PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../third_party/llama.cpp/include
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../third_party/llama.cpp/ggml/include)

target_link_libraries(native-lib PRIVATE llama log)
