/* eslint-disable @typescript-eslint/no-explicit-any */

class ApiResponse<T> {
  constructor(
    public status: number,
    public data: T,
    public raw: any,
  ) {}

  async value(): Promise<T> {
    return this.data;
  }
}

import { useEffect, useMemo, useRef, useState } from "react";
import useApiMutateData, { MutationOptionsType } from "./useApiMutateData";

/* 
  Data represents the data type that the query function will return.
  Body represents the type of the body object that the mutation function will receive.
*/

type OptionsType<Data, Body> = {
  mutationFn: MutationOptionsType<ApiResponse<Data>, Body>["mutationFn"];
  intervalDelay?: number; // The delay between polling requests
} & Omit<MutationOptionsType<Data, Body>, "mutationFn">;

const useApiMutatePollData = <Data, Body = any>(
  options: OptionsType<Data, Body>,
) => {
  // timout IDs References
  const pollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [apiRawData, setApiRawData] = useState<
    ApiResponse<Data>["raw"] | undefined
  >(undefined);

  const mutation = useApiMutateData<Data, Body>({
    ...options,
    // Here we move the polling logic to the mutation function, this way we can keep the polling logic in one place and maintain the same API provided to use by TanStack
    mutationFn: async (body: Body) => {
      const polledResponse = new Promise<Data>((resolve, reject) => {
        const sendHTTPRequest = async () => {
          try {
            const response = await options.mutationFn?.(body);
            setApiRawData(response?.raw);

            if (response?.raw.status === 202) {
              pollTimeoutRef.current = setTimeout(
                sendHTTPRequest,
                options.intervalDelay ?? 15000,
              );
              return;
            } else if (response?.raw.status === 200) {
              const resolvedValue = await response.value();
              resolve(resolvedValue);
            } else {
              reject(new Error("Unable to get a successful response"));
            }
          } catch (e) {
            reject(
              new Error(
                (e as any) ?? new Error("unable to get a successful response"),
              ),
            );
          }
        };
        sendHTTPRequest();
      });
      return await polledResponse;
    },
  });

  const dataRef = useRef(mutation.data);
  // this is to ensure we have the data to display when new data is undefined due to being fetched
  /* eslint-disable @typescript-eslint/no-unused-expressions */
  const memoizedData = useMemo(() => {
    if (mutation.status === "error") {
      dataRef.current = undefined;
      return dataRef.current;
    }
    if (mutation.data) {
      dataRef.current = mutation.data;
    }
    return dataRef.current;
  }, [mutation.data, mutation.status]);

  //cleanup
  useEffect(() => {
    return () => {
      pollTimeoutRef.current && clearTimeout(pollTimeoutRef.current);
    };
  }, [pollTimeoutRef, clearTimeout]);

  // Override the defualt mutation results to reflect the polling process
  const customResult = {
    raw: apiRawData,
    data: memoizedData,
  };

  return { ...mutation, ...customResult };
};

export default useApiMutatePollData;
