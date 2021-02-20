import { isLocalCacheExists, REQUIRED_LOCAL_CACHE_FILES } from './local-cache';
import { getFilePathsToScan } from './file-loader';
import { parseFilesForScan } from './file-parser';
import { scanFilesForIssues } from './file-scanner';
import { formatResults } from './results-formatter';
import { isLocalFolder } from '../../../../lib/detect';

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// the current version is dependent on files to be present locally which are not part of the source code.
// without these files this method would fail.
// if you're interested in trying out the experimental local execution model for IaC scanning, please reach-out.
export async function test(pathToScan: string, options) {
  if (!isLocalCacheExists())
    throw Error(
      `Missing IaC local cache data, please validate you have: \n${REQUIRED_LOCAL_CACHE_FILES.join(
        '\n',
      )}`,
    );
  const filePathsToScan = await getFilePathsToScan(pathToScan);
  const { parsedFiles, failedFiles } = await parseFilesForScan(filePathsToScan);
  const scannedFiles = await scanFilesForIssues(parsedFiles);
  const formattedResults = formatResults(scannedFiles, options);

  if (isLocalFolder(pathToScan)) {
    // TODO: This mutation is here merely to support how the old/current directory scan printing works.
    options.iacDirFiles = [...parsedFiles, ...failedFiles];
  }

  // TODO: add support for proper typing of old TestResult interface.
  return formattedResults as any;
}
