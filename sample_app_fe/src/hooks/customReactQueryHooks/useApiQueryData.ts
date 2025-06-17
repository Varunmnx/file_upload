import {
  CancelOptions,
  QueryFilters,
  QueryKey,
  UseQueryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* 
 T represents the data type that the query function will return.
  E represents the error type that the query function can throw.
  Q represents the query key type.
*/
type E = Error;
type Q = QueryKey;

type OptionsType<T = any> = {
  queryFn: UseQueryOptions<T, E, T, Q>["queryFn"];
  queryKey: UseQueryOptions<T, E, T, Q>["queryKey"];
} & UseQueryOptions<T, E, T, Q>;

type MSBQueryResultType<T = any> = ReturnType<typeof useQuery<T, E, T, Q>>;

const useApiQueryData = <T>(options: OptionsType<T>) => {
  const query = useQuery({
    ...options,
  });

  const cancel = (
    queryClient: ReturnType<typeof useQueryClient>,
    cancelConfig?: {
      queryFilters: Partial<Omit<QueryFilters, "queryKey">>;
      cancelOptions: Partial<CancelOptions>;
    },
  ) => {
    queryClient.cancelQueries(
      {
        ...cancelConfig?.queryFilters,
        queryKey: options.queryKey,
      },
      cancelConfig?.cancelOptions,
    );
  };

  return { ...query, cancel };
};

export type { OptionsType as MSBQueryOptionsType, MSBQueryResultType };

export default useApiQueryData;
