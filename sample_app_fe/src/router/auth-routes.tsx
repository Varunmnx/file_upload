import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout";
import ErrorPage from "@/pages/Error";
import { RouteObject, useRoutes } from "react-router-dom";

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
  const routes = useRoutes([authRouteElements]);
  return routes;
};

export default AuthRoutes;
