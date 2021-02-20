import { makeDirectoryIterator } from '../../../../lib/iac/makeDirectoryIterator';
import * as fs from 'fs';
import * as util from 'util';
import { IacFileData, VALID_FILE_TYPES } from './types';
import { getFileType } from '../../../../lib/iac/iac-parser';
import { IacFileTypes } from '../../../../lib/iac/constants';
import { isLocalFolder } from '../../../../lib/detect';

const loadFileContents = util.promisify(fs.readFile);
const DEFAULT_ENCODING = 'utf-8';

export async function getFilePathsToScan(pathToScan): Promise<IacFileData[]> {
  if (isLocalFolder(pathToScan)) {
    const filePaths = await getFilePathsFromDirectory(pathToScan);
    if (filePaths.length === 0) {
      throw Error('No valid IaC files found in provided directory');
    }
    return filePaths;
  }

  const fileType = getFileType(pathToScan);
  if (VALID_FILE_TYPES.includes(fileType)) {
    const fileContent = await loadFileContents(pathToScan, DEFAULT_ENCODING);
    return [
      {
        filePath: pathToScan,
        fileType: getFileType(pathToScan) as IacFileTypes,
        fileContent,
      },
    ];
  }

  throw Error('Invalid IaC File!');
}

async function getFilePathsFromDirectory(
  pathToScan: string,
): Promise<Array<IacFileData>> {
  const directoryPaths = makeDirectoryIterator(pathToScan, {
    maxDepth: 6,
  });

  const directoryFilePaths: IacFileData[] = [];
  for (const filePath of directoryPaths) {
    const fileType = getFileType(filePath);

    if (VALID_FILE_TYPES.includes(fileType)) {
      const fileContent = await loadFileContents(filePath, DEFAULT_ENCODING);

      directoryFilePaths.push({
        filePath: filePath as string,
        fileType: fileType as IacFileTypes,
        fileContent,
      });
    }
  }
  return directoryFilePaths;
}
