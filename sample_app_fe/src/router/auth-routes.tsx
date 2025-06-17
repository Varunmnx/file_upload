import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout";
import ErrorPage from "@/pages/Error";
import { RouteObject } from "react-router-dom";

enum Path {
  ROOT = "/",
}

const authRouteElements: RouteObject = {
  errorElement: <ErrorPage />,
  element: (
    <GlobalErrorHandlerContextProvider>
      <RootLayout />
    </GlobalErrorHandlerContextProvider>
  ),
  children: [
    {
      path: Path.ROOT,
      element: <>AuthenticatedPage</>,
    },
  ],
};

const AuthRoutes = () => {
  return <>{authRouteElements}</>;
};

export default AuthRoutes;
