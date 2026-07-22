declare module "pdfjs-dist/webpack.mjs" {
  const lib: typeof import("pdfjs-dist");
  export = lib;
}

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}

