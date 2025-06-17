import { useCallback, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const useDownloadPdf = () => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const downloadPdf = useCallback(
    async (element: HTMLElement, fileName: string = "examplepdf.pdf") => {
      setIsGeneratingPdf(true);
      const canvas = await html2canvas(element, {
        scale: 2,
      });

      const data = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: "a4",
      });

      const imgProperties = pdf.getImageProperties(data);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProperties.height * pdfWidth) / imgProperties.width;

      pdf.addImage(data, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(fileName);
      setIsGeneratingPdf(false);
    },
    [],
  );

  return { downloadPdf, isGeneratingPdf };
};
