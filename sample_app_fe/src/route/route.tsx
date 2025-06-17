import ProtectedRoutes from "@/router/auth-routes";
import { PublicRoutes } from "@/router/public-routes";

const CustomRouter = () => {
  const isAuthenticated = false;

  return isAuthenticated ? <ProtectedRoutes /> : <PublicRoutes />;
};

export default CustomRouter;
