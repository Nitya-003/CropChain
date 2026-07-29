# ─── Benchmarks (optional — requires Google Benchmark installed) ───────────────
find_package(benchmark QUIET)
if(benchmark_FOUND)
    add_executable(CinderPeak_bench benchmarks/bench_core_operations.cpp)
    target_link_libraries(CinderPeak_bench benchmark::benchmark CinderPeak)
    message(STATUS "Google Benchmark found — CinderPeak_bench target enabled")
else()
    message(STATUS "Google Benchmark not found — skipping benchmark target")
endif()