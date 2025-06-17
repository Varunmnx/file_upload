import { Suspense } from "react";
import { Outlet } from "react-router-dom";

const ExampleLayout = () => {
  return (
    <Suspense>
      <Outlet />
    </Suspense>
  );
};

export default ExampleLayout;
