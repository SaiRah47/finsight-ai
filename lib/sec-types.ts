export type SecFiling={id:string;form:string;filed:string;reportDate:string|null;accession:string;url:string;description:string;primaryDocument:string};
export type SecFact={id:string;label:string;value:number;unit:string;end:string;filed:string;form:string;accession:string;url:string;fiscalYear:number|null};
export type SecCompany={symbol:string;name:string;cik:string;filings:SecFiling[];facts:SecFact[];source:'SEC EDGAR';fetchedAt:string;warnings:string[]};
