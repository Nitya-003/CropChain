#include <benchmark/benchmark.h>
#include "CinderPeak.hpp"

using namespace CinderPeak;

// Benchmark: how long does adding N vertices take?
static void BM_AddVertex(benchmark::State& state) {
    for (auto _ : state) {
        CinderGraph<int, int> g(GraphCreationOptions({GraphCreationOptions::Directed}));
        for (int i = 0; i < state.range(0); ++i)
            g.addVertex(i);
    }
    state.SetComplexityN(state.range(0));
}
BENCHMARK(BM_AddVertex)->Range(1 << 10, 1 << 18)->Complexity();

// Benchmark: how long does adding N edges take?
static void BM_AddEdge(benchmark::State& state) {
    CinderGraph<int, int> g(GraphCreationOptions({GraphCreationOptions::Directed}));
    for (int i = 0; i < state.range(0); ++i)
        g.addVertex(i);
    for (auto _ : state) {
        for (int i = 0; i < state.range(0) - 1; ++i)
            g.addEdge(i, i + 1, 1);
    }
    state.SetComplexityN(state.range(0));
}
BENCHMARK(BM_AddEdge)->Range(1 << 10, 1 << 16)->Complexity();

// Benchmark: how long does a neighbor lookup take on a 1000-node graph?
static void BM_NeighborLookup(benchmark::State& state) {
    CinderGraph<int, int> g(GraphCreationOptions({GraphCreationOptions::Directed}));
    for (int i = 0; i < 1000; ++i)
        g.addVertex(i);
    for (int i = 0; i < 999; ++i)
        g.addEdge(i, i + 1, 1);
    for (auto _ : state) {
        benchmark::DoNotOptimize(g.neighbors(500));
    }
}
BENCHMARK(BM_NeighborLookup);

BENCHMARK_MAIN();