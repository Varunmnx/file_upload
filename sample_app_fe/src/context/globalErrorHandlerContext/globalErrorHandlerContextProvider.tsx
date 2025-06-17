import { useCallback, useMemo, useState } from "react";
import { GlobalErrorHandlerType } from "./types/error.type";
import GlobalErrorHandlerContext from "./global-error-handler-context";

const GlobalErrorHandlerContextProvider = ({
  children,
}: {
  children: React.ReactElement;
}) => {
  const [errors, setErrors] = useState<GlobalErrorHandlerType[]>(
    [] as GlobalErrorHandlerType[],
  );

  const addError = useCallback(
    (error: GlobalErrorHandlerType) => {
      setErrors([...errors, error]);
    },
    [setErrors, errors],
  );

  const removeError = useCallback(
    (error: GlobalErrorHandlerType) => {
      setErrors(errors.filter((err) => err.message !== error.message));
    },
    [setErrors, errors],
  );

  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, [setErrors]);

  const value = useMemo(
    () => ({ errors, addError, removeError, clearAllErrors }),
    [errors, addError, removeError, clearAllErrors],
  );

  return (
    <GlobalErrorHandlerContext.Provider value={value}>
      {children}
    </GlobalErrorHandlerContext.Provider>
  );
};

export default GlobalErrorHandlerContextProvider;
