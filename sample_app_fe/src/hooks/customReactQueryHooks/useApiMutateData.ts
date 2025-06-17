import {
  MutateOptions,
  UseMutationOptions,
  useMutation,
} from "@tanstack/react-query";

/* 
  T represents the data type that the query function will return.
  E represents the error type that the query function can throw.
  B represents the type of the body object that the mutation function will receive.
*/

type E = Error;

type MutationOptionsType<T, B> = {
  mutationFn: UseMutationOptions<T, E, B>["mutationFn"];
  mutationKey: UseMutationOptions<T, E, B>["mutationKey"];
} & UseMutationOptions<T, E, B>;

type MutateOptionsType<T, B> = MutateOptions<T, E, B>;

type MutationResultType<T, B> = ReturnType<typeof useMutation<T, E, B>>;

const useApiMutateData = <T, B>(options: MutationOptionsType<T, B>) => {
  return useMutation<T, E, B>({ ...options });
};

export type { MutationOptionsType, MutationResultType, MutateOptionsType };

export default useApiMutateData;
