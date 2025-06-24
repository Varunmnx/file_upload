import "./index.css";
import { BrowserRouter } from "react-router-dom";
import PublicRoutes from "./router/public-routes";
import AuthRoutes from "./router/auth-routes";

function App() {
  const authenticated = false
  return (
    <BrowserRouter>
      { authenticated ? <AuthRoutes/> :<PublicRoutes />}
    </BrowserRouter>
  )
}

export default App;
