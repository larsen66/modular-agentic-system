import { useQuery } from '@tanstack/react-query'
import { fetchRegistry, type KernelRegistry } from '@/core/kernel'

// Loads the kernel's harness × environment registry once (5-min cache) for the composer selector.
// The seam is core/kernel.fetchRegistry (GET /registry) — features never call the backend directly.
export function useKernelRegistry() {
  const { data, isLoading } = useQuery<KernelRegistry>({
    queryKey: ['kernel', 'registry'],
    queryFn: fetchRegistry,
    staleTime: 5 * 60_000,
    retry: 1,
  })
  return {
    harnesses: data?.harnesses ?? [],
    environments: data?.environments ?? [],
    readyPairs: data?.readyPairs ?? [],
    defaults: data?.defaults,
    isLoading,
  }
}
