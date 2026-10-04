declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }
  
  interface PDFOptions {
    pagerender?: (pageData: any) => Promise<string>;
    max?: number;
    version?: string;
  }
  
  function pdf(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  export = pdf;
}

declare module 'mammoth' {
  interface ConversionResult {
    value: string;
    messages: any[];
  }
  
  interface Options {
    buffer: Buffer;
  }
  
  function extractRawText(options: Options): Promise<ConversionResult>;
  function convertToHtml(options: Options): Promise<ConversionResult>;
}
