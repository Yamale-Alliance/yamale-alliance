declare module "docshift" {
  export function toDocx(html: string | HTMLElement): Promise<Blob>;
  export function toHtml(file: Blob | ArrayBuffer): Promise<string>;
}
