import "./index.css";
import { useTranslation } from "react-i18next";
import { Languages } from "./utils/enum/languages";
import { Image } from "@mantine/core";
import { DogImage } from "./assets/images/png";
import FileUploadApp from "./pages/FileUpload";

function App() {
  const { t, i18n } = useTranslation();

  const changeLanguage = (language: Languages) => {
    i18n.changeLanguage(language);
  };
  // return (
  //   <div className="bg-gray-300">
  //     <h1>{t("welcome")}</h1>
  //     <p>{t("description")}</p>

  //     <button
  //       onClick={() => changeLanguage(Languages.EN)}
  //       className="font-bold rounded-md bg-primary"
  //     >
  //       English
  //     </button>
  //     <button
  //       onClick={() => changeLanguage(Languages.FR)}
  //       className="bg-green-300"
  //     >
  //       Français
  //     </button>
  //     <Image src={DogImage} height={100} width={200} />
  //   </div>
  // );

  return <FileUploadApp />
}

export default App;
