import { ErrorResponse, useRouteError } from "react-router-dom";

const ErrorPage = () => {
  const error = useRouteError() as ErrorResponse;
  if (error && error.status) {
    switch (error.status) {
      case 404:
        return <h1>Not Found</h1>;
      case 500:
        return <h1>Internal Server Error</h1>;
      case 403:
        return <h1>Forbidden</h1>;
      case 503:
        return <h1>Server OverLoad</h1>;
      default:
        return <h1>Unknown Error</h1>;
    }
  }
};

export default ErrorPage;
