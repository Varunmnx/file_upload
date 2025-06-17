import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout";
import Login from "@/pages/Auth/Login";
import ErrorPage from "@/pages/Error";
import LandingPage from "@/pages/Landing";
import { RouteObject } from "react-router-dom";

enum Path {
  ROOT = "/",
  ContextProvider = "/ContextProvider",
  LOGIN = "/auth/login",
  PRODUCTS = "/products",
}

const publicRoutes: RouteObject = {
  errorElement: <ErrorPage />,
  element: (
    <GlobalErrorHandlerContextProvider>
      <RootLayout />
    </GlobalErrorHandlerContextProvider>
  ),
  children: [
    {
      path: Path.ROOT,
      element: <LandingPage />,
    },
    {
      path: Path.LOGIN,
      element: <Login />,
    },
  ],
};

export const PublicRoutes = () => <>{publicRoutes}</>;
