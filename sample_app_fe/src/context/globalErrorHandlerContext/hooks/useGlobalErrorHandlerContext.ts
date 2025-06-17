import { useContext } from "react";
import GlobalErrorHandlerContext from "../global-error-handler-context";

export const useGlobalErrorHandlerContext = () =>
  useContext(GlobalErrorHandlerContext);
