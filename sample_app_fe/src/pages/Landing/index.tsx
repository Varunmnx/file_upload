import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
// import { queryClient } from "../../main"
import clsx from "clsx";
const LandingPage = () => {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(0);

  function refetchQueryTest() {
    queryClient.refetchQueries({
      queryKey: ["test"],
    });
  }
  return (
    <div className={clsx("bg-red-500 h-screen")}>
      <button
        onClick={() => setCount(count + 1)}
        className="bg-green-400  p-5 rounded-md"
      >
        click me {count}
      </button>
      <button
        onClick={() => refetchQueryTest()}
        className="bg-green-500  p-5 rounded-md"
      >
        click me to trigger refetch {count}
      </button>
    </div>
  );
};

export default LandingPage;
