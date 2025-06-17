import { MutationKey, QueryClient } from "@tanstack/react-query";

export function clearQueryClientCache(
  queryClient: QueryClient,
  queryKey: MutationKey,
) {
  queryClient.removeQueries({
    queryKey: queryKey,
  });
}
