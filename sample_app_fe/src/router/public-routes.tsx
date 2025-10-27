// src/router/public-routes.tsx

import GlobalErrorHandlerContextProvider from "@/context/globalErrorHandlerContext/globalErrorHandlerContextProvider";
import RootLayout from "@/Layout/ExampleLayout";
import ChunkedUploader from "@/pages/ChunkedUpload";
import ErrorPage from "@/pages/Error";
import FileUploadApp from "@/pages/FileUpload";
import FixedChunkedUpload from "@/pages/FileUploadChunked";
// import LandingPage from "@/pages/Landing";
import { RouteObject, useRoutes } from "react-router-dom";

enum Path {
  ROOT = "/",
  ContextProvider = "/ContextProvider",
  LOGIN = "/auth/login",
  PRODUCTS = "/products",
  CHUNKED = "/file-upload/chunked",
  MIXED_UPLOAD = "/mixed-upload",
  ChunkedV2 = "/file-upload/chunked-v2",
}

export const publicRoutes: RouteObject[] = [
  {
    element: (
      <GlobalErrorHandlerContextProvider>
        <RootLayout />
      </GlobalErrorHandlerContextProvider>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        path: Path.ROOT,
        element: <FixedChunkedUpload />,
      },
      {
        path: Path.MIXED_UPLOAD,
        element: <FileUploadApp />,
      },
      {
        path: Path.CHUNKED,
        element: <FixedChunkedUpload />,
      },
      {
        path: Path.ChunkedV2,
        element: <ChunkedUploader />,
      },
    ],
  },
];


export const PublicRoutes = () => {
  const routes = useRoutes(publicRoutes);
  return routes;
};


export default PublicRoutes;