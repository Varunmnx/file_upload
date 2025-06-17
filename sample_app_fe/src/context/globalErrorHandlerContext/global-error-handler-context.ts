// src/context/globalErrorHandlerContext/GlobalErrorHandlerContext.ts
import { createContext } from "react";
import { GlobalErrorHandlerType } from "./types/error.type";

interface GlobalErrorHandlerContextType {
  errors: GlobalErrorHandlerType[];
  addError: (error: GlobalErrorHandlerType) => void;
  removeError: (error: GlobalErrorHandlerType) => void;
  clearAllErrors: () => void;
}

const GlobalErrorHandlerContext = createContext<GlobalErrorHandlerContextType>(
  {} as GlobalErrorHandlerContextType,
);

export default GlobalErrorHandlerContext;
