import {
  ActionIcon,
  createTheme,
  Loader,
  MantineColorsTuple,
} from "@mantine/core";

const azureBlue: MantineColorsTuple = [
  "#E6F2FF",
  "#cde6ff",
  "#9bccff",
  "#64afff",
  "#3997fe",
  "#1e87fe",
  "#0980ff",
  "#006de4",
  "#0061cd",
  "#0054b5",
];

export const theme = createTheme({
  colors: {
    azureBlue,
  },
  primaryColor: "azureBlue",
  white: "#FFFFFF",
  black: "#292929",
  defaultRadius: "md",
  focusRing: "never",
  fontFamily: "Open Sans, sans-serif",
  headings: { fontFamily: "Open Sans, sans-serif" },
  components: {
    ActionIcon: ActionIcon.extend({
      defaultProps: {
        variant: "subtle",
      },
    }),
    Loader: Loader.extend({
      defaultProps: {
        type: "bars",
      },
    }),
  },
});
