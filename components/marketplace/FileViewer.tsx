"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, FileText, Video, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

type FileViewerProps = {
  fileUrl: string;
  fileName: string | null;
  fileFormat: string | null;
  onClose: () => void;
};

export function FileViewer({ fileUrl, fileName, fileFormat, onClose }: FileViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const isPdf = fileFormat?.toLowerCase() === "pdf" || fileName?.toLowerCase().endsWith(".pdf");
  const isVideo =
    fileFormat?.toLowerCase() === "mp4" ||
    fileFormat?.toLowerCase() === "webm" ||
    fileFormat?.toLowerCase() === "mov" ||
    fileName?.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv)$/i);

  useEffect(() => {
    // Prevent body scroll when viewer is open
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
      // Cancel any ongoing render task on unmount
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, []);

  const renderPage = async (pdf: any, page: number, scaleValue: number) => {
    if (!canvasRef.current) return;
    
    // Cancel any ongoing render task
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const pageData = await pdf.getPage(page);
      const viewport = pageData.getViewport({ scale: scaleValue });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) {
        console.error("Failed to get canvas context");
        return;
      }

      // Clear the canvas before rendering
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = pageData.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      // Ignore cancellation errors
      if (err?.name === "RenderingCancelledException" || err?.message?.includes("cancelled")) {
        return;
      }
      console.error("Error rendering page:", err);
      setError("Failed to render page");
    }
  };

  // Load PDF using PDF.js
  useEffect(() => {
    if (!isPdf || !fileUrl) return;

    const loadPdf = async () => {
      try {
        // Prefer webpack entry so the worker is created with type: "module" (avoids "Unexpected token export" from public .mjs)
        let pdfjsLib: typeof import("pdfjs-dist");
        try {
          pdfjsLib = await import("pdfjs-dist/webpack.mjs");
        } catch {
          // Fallback: main build without worker (no workerSrc) to avoid ESM parse errors
          pdfjsLib = await import("pdfjs-dist");
        }

        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
        renderPage(pdf, 1, 1.0);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError("Failed to load PDF");
        setLoading(false);
      }
    };

    loadPdf();
  }, [fileUrl, isPdf]);

  useEffect(() => {
    if (pdfRef.current && pageNum > 0) {
      renderPage(pdfRef.current, pageNum, scale);
    }
  }, [pageNum, scale]);

  const handlePreviousPage = () => {
    if (pageNum > 1) {
      setPageNum(pageNum - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum(pageNum + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleVideoLoad = () => {
    setLoading(false);
  };

  const handleVideoError = () => {
    setLoading(false);
    setError("Failed to load video");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative flex h-full w-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            {isPdf ? (
              <FileText className="h-5 w-5 text-white" />
            ) : isVideo ? (
              <Video className="h-5 w-5 text-white" />
            ) : (
              <FileText className="h-5 w-5 text-white" />
            )}
            <span className="text-sm font-medium text-white truncate max-w-md">
              {fileName || "File"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white hover:bg-white/10 transition-colors"
            aria-label="Close viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
          {error ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-white text-lg mb-2">{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : isPdf ? (
            <div className="flex h-full flex-col items-center justify-center overflow-auto bg-gray-900 p-4">
              {/* PDF Controls */}
              <div className="mb-4 flex items-center gap-4 rounded-lg border border-white/10 bg-black/50 px-4 py-2 backdrop-blur">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={pageNum <= 1}
                  className="rounded p-1.5 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-white">
                  Page {pageNum} of {numPages}
                </span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={pageNum >= numPages}
                  className="rounded p-1.5 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="mx-2 h-6 w-px bg-white/20" />
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.5}
                  className="rounded p-1.5 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                <span className="text-sm text-white min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={scale >= 3.0}
                  className="rounded p-1.5 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
              </div>
              {/* PDF Canvas */}
              <div className="flex-1 overflow-auto">
                <canvas
                  ref={canvasRef}
                  className="mx-auto shadow-2xl"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              </div>
            </div>
          ) : isVideo ? (
            <div className="flex h-full items-center justify-center bg-black">
              <video
                src={fileUrl}
                controls
                controlsList="nodownload"
                className="max-h-full max-w-full"
                onLoadedData={handleVideoLoad}
                onError={handleVideoError}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-white">
                <p className="mb-4">Preview not available for this file type.</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
