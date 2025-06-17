/* eslint-disable @typescript-eslint/no-unused-expressions */
import { createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { AppDispatch, RootState } from "./root-store";
import { AxiosError } from "axios";
import { GenericState } from "./type";
import { ApiCallStatus } from "../../services";
import { toast } from "sonner";

/**
 * ? A utility function to create a typed Async Thunk Actions.
 */
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: unknown;
}>();

/**
 * Creates a fetch thunk for making API calls.
 */
export const createFetchThunk = <T, P = void>(
  thunkName: string,
  apiMethod: (param: P) => Promise<T>,
) =>
  createAppAsyncThunk<T, P, { rejectValue: unknown }>(
    thunkName,
    async (param: P, thunkAPI) => {
      try {
        const response = await apiMethod(param);
        return response;
      } catch (error: unknown) {
        return thunkAPI.rejectWithValue((error as AxiosError).response?.data);
      }
    },
  );

/**
 * Creates a pending handler function for updating state.
 *
 * @param updateState - A function to update state during the pending state.
 *
 * @returns A function that updates state based on the pending status.
 */
export const createPendingHandler =
  <S extends GenericState, T = void>(
    updateState: (state: S, action?: PayloadAction<T>) => void = (state) => {
      state.status = ApiCallStatus.Loading;
    },
  ) =>
  (state: S, action?: PayloadAction<T>) => {
    updateState(state, action);
  };

/**
 * Creates a fulfilled handler function for updating state.
 *
 * @param successMessage - Message to show on successful fulfillment.
 * @param updateState - A function to update state during the fulfilled state.
 * @param onSuccess - Optional callback to execute on success.
 *
 * @returns A function that updates state based on the fulfilled status.
 */
export const createFulfilledHandler =
  <S extends GenericState, T>(
    successMessage?: string,
    updateState: (state: S, action: PayloadAction<T>) => void = (state) => {
      state.status = ApiCallStatus.Idle;
    },
    onSuccess?: (state: S, action: PayloadAction<T>) => void,
  ) =>
  (state: S, action: PayloadAction<T>) => {
    updateState(state, action);
    if (action.payload) {
      successMessage && toast.success(successMessage);
      onSuccess?.(state, action);
    }
  };

/**
 * Creates a rejected handler function for updating state.
 *
 * @param errorMessage - Message to show on rejection.
 * @param updateState - A function to update state during the rejected state.
 * @param onError - Optional callback to execute on error.
 *
 * @returns A function that updates state based on the rejected status.
 */
export const createRejectedHandler =
  <S extends GenericState, T = void>(
    errorMessage?: string,
    updateState: (state: S, action?: PayloadAction<T>) => void = (state) => {
      state.status = ApiCallStatus.Failed;
    },
    onError?: (state: S) => void,
  ) =>
  (state: S, action?: PayloadAction<T>) => {
    updateState(state, action);
    errorMessage && toast.error(errorMessage);
    onError?.(state);
  };
