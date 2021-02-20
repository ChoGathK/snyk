import { SEVERITY } from '../../../../lib/snyk-test/common';
import { IacFileInDirectory } from '../../../../lib/types';

export interface IacFileData extends IacFileInDirectory {
  fileContent: string;
}
export const VALID_FILE_TYPES = ['tf', 'json', 'yaml', 'yml'];

export interface ParsedIacFile extends IacFileData {
  jsonContent: Record<string, any>;
  engineType: EngineType;
  docId?: number;
}

export interface FailedIacFileParse extends IacFileData {
  jsonContent: null;
  engineType: null;
  failureReason: string;
  err: Error;
}

export type ScanningResults = {
  scannedFiles: Array<IacFileScanResult>;
  unscannedFiles: Array<FailedIacFileParse>;
};

export type ParsingResults = {
  parsedFiles: Array<ParsedIacFile>;
  failedFiles: Array<FailedIacFileParse>;
};

export interface IacFileScanResult extends ParsedIacFile {
  violatedPolicies: PolicyMetadata[];
}

export interface OpaWasmInstance {
  evaluate: (data: Record<string, any>) => { results: PolicyMetadata[] };
  setData: (data: Record<string, any>) => void;
}

export enum EngineType {
  Kubernetes,
  Terraform,
}
export interface PolicyMetadata {
  id: string;
  publicId: string;
  type: string;
  subType: string;
  title: string;
  description: string;
  severity: SEVERITY;
  msg: string;
  policyEngineType: 'opa';
  issue: string;
  impact: string;
  resolve: string;
  references: string[];
}
