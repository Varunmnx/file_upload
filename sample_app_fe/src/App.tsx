import "./index.css";
import { BrowserRouter } from "react-router-dom";
import PublicRoutes from "./router/public-routes";
import AuthRoutes from "./router/auth-routes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function App() {
  const authenticated = false
  const client = new QueryClient()
  return (
    <BrowserRouter>
    <QueryClientProvider client={client}>
       { authenticated ? <AuthRoutes/> :<PublicRoutes />}
    </QueryClientProvider>
    </BrowserRouter>
  )
}

export default App;
