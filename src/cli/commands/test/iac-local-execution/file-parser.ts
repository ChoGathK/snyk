import * as hclToJson from 'hcl-to-json';
import * as YAML from 'js-yaml';
import {
  EngineType,
  ParsedIacFile,
  IacFileData,
  ParsingResults,
  FailedIacFileParse,
} from './types';

const REQUIRED_K8S_FIELDS = ['apiVersion', 'kind', 'metadata'];

export async function parseFilesForScan(
  filesData: IacFileData[],
): Promise<ParsingResults> {
  const parsedFiles: Array<ParsedIacFile> = [];
  const failedFiles: Array<FailedIacFileParse> = [];
  for (const fileData of filesData) {
    try {
      parsedFiles.push(...tryParseIacFile(fileData));
    } catch (err) {
      if (filesData.length === 1) throw err;
      failedFiles.push(generateFailedParsedFile(fileData, err));
    }
  }

  return {
    parsedFiles,
    failedFiles,
  };
}

function generateFailedParsedFile(
  { fileType, filePath, fileContent }: IacFileData,
  err: Error,
) {
  return {
    err,
    failureReason: err.message,
    fileType,
    filePath,
    fileContent,
    engineType: null,
    jsonContent: null,
  };
}

function tryParseIacFile(fileData: IacFileData): Array<ParsedIacFile> {
  switch (fileData.fileType) {
    case 'yaml':
    case 'yml':
    case 'json':
      return tryParsingKubernetesFile(fileData);
    case 'tf':
      return tryParsingTerraformFile(fileData);
    default:
      throw new Error('Invalid IaC file');
  }
}

function tryParsingKubernetesFile(fileData: IacFileData): ParsedIacFile[] {
  const yamlDocuments = YAML.safeLoadAll(fileData.fileContent);

  return yamlDocuments.map((parsedYamlDocument, docId) => {
    if (
      REQUIRED_K8S_FIELDS.every((requiredField) =>
        parsedYamlDocument.hasOwnProperty(requiredField),
      )
    ) {
      return {
        ...fileData,
        jsonContent: parsedYamlDocument,
        engineType: EngineType.Kubernetes,
        docId,
      };
    } else {
      throw new Error('Invalid K8s File!');
    }
  });
}

function tryParsingTerraformFile(fileData: IacFileData): Array<ParsedIacFile> {
  try {
    // TODO: This parser does not fail on inavlid Terraform files! it is here temporarily.
    // cloud-config team will replace it to a valid parser for the beta release.
    const parsedData = hclToJson(fileData.fileContent);
    return [
      {
        ...fileData,
        jsonContent: parsedData,
        engineType: EngineType.Terraform,
      },
    ];
  } catch (err) {
    throw new Error('Invalid Terraform File!');
  }
}
