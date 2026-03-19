"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  ZoomInIcon,
  ZoomOutIcon,
  DownloadIcon,
  FileTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderIcon,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfViewer({ open, onOpenChange }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const pdfUrl = "/133-vbhn-vpqh.pdf";

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setPageNumber(1);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "Luat-Dat-Dai-2024.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
      >
        <SheetHeader className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <FileTextIcon className="size-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">Luật Đất Đại 2024</SheetTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Văn bản số 133/2024/VB-HN-VPQH
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="size-9"
              >
                <ZoomOutIcon className="size-4" />
                <span className="sr-only">Zoom out</span>
              </Button>
              <span className="min-w-[3rem] text-center text-xs font-medium text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={scale >= 2.5}
                className="size-9"
              >
                <ZoomInIcon className="size-4" />
                <span className="sr-only">Zoom in</span>
              </Button>
              <div className="h-6 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="size-9"
              >
                <DownloadIcon className="size-4" />
                <span className="sr-only">Download PDF</span>
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Page Navigation */}
        <div className="flex items-center justify-center gap-3 border-b bg-background px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="size-8"
          >
            <ChevronLeftIcon className="size-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <span className="text-sm font-medium">
            Trang {pageNumber} / {numPages || "..."}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="size-8"
          >
            <ChevronRightIcon className="size-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>

        {/* PDF Document */}
        <div className="relative flex-1 overflow-auto bg-muted/10 p-4">
          <div className="flex min-h-full items-start justify-center">
            <Document
              file={pdfUrl}
              onLoadSuccess={handleDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-20">
                  <LoaderIcon className="size-8 animate-spin text-primary" />
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileTextIcon className="mb-3 size-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Không thể tải tài liệu PDF
                  </p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
              />
            </Document>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
