import { counterSlice } from "../features/counter";

export const reducer = {
  [counterSlice.name]: counterSlice.reducer,
};
