import { encryptPDF } from "@pdfsmaller/pdf-encrypt";

export interface ProtectOptions {
  /** Password required to open the document. */
  userPassword: string;
  /** Optional password that grants permission-management rights. */
  ownerPassword?: string;
  restrictPrinting?: boolean;
  restrictCopying?: boolean;
}

/**
 * Encrypts a PDF with password protection and optional permission restrictions.
 *
 * NOTE (deviation from PRD): the PRD originally specified `PDFDocument.encrypt`
 * from pdf-lib, but pdf-lib does NOT support writing encrypted documents (it
 * can only load them with `ignoreEncryption`). We therefore use
 * `@pdfsmaller/pdf-encrypt` (AES-256, PDF 2.0 R=6) which runs fully in the
 * browser via the Web Crypto API. AES-256 requires a secure context (HTTPS or
 * localhost); the preview/production deploys are served over HTTPS.
 */
export async function protectPdf(
  buffer: Uint8Array,
  opts: ProtectOptions
): Promise<Uint8Array> {
  const encrypted = await encryptPDF(buffer, opts.userPassword, {
    ownerPassword: opts.ownerPassword || opts.userPassword,
    algorithm: "AES-256",
    allowPrinting: !opts.restrictPrinting,
    allowCopying: !opts.restrictCopying,
    allowModifying: true,
    allowAnnotating: true,
    allowFillingForms: true,
    allowExtraction: true,
    allowAssembly: true,
    allowHighQualityPrint: !opts.restrictPrinting,
  });
  return encrypted;
}
