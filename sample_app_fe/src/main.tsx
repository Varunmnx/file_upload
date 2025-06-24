import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n.ts";
import { MantineProvider } from "@mantine/core";
import { theme } from "./theme/index.ts";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={theme}>
     <App />
  </MantineProvider>,
);


