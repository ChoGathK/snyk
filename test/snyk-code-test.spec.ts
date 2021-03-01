import * as fs from 'fs';
import * as path from 'path';
import { analyzeFolders, AnalysisSeverity } from '@snyk/code-client';
jest.mock('@snyk/code-client');
const analyzeFoldersMock = analyzeFolders as jest.Mock;

import { loadJson } from './utils';
import * as featureFlags from '../src/lib/feature-flags';
import { config as userConfig } from '../src/lib/user-config';
import { getCodeAnalysisAndParseResults } from '../src/lib/plugins/code/analysis';
import { Options, TestOptions } from '../src/lib/types';
import * as ecosystems from '../src/lib/ecosystems';
const osName = require('os-name');

describe('Test snyk code', () => {
  let apiUserConfig;
  let isFeatureFlagSupportedForOrgSpy;
  const fakeApiKey = '123456789';
  const sampleSarifResponse = loadJson(
    __dirname + '/fixtures/code/sample-sarif.json',
  );
  const sampleAnalyzeFoldersResponse = loadJson(
    __dirname + '/fixtures/code/sample-analyze-folders-response.json',
  );

  const isWindows =
    osName()
      .toLowerCase()
      .indexOf('windows') === 0;
  const fixturePath = path.join(__dirname, 'fixtures', 'code');
  const cwd = process.cwd();

  function readFixture(filename: string) {
    if (isWindows) {
      filename = filename.replace('.txt', '-windows.txt');
    }
    const filePath = path.join(fixturePath, filename);
    return fs.readFileSync(filePath, 'utf-8');
  }
  const testOutput = readFixture('test-output.txt');

  beforeAll(() => {
    process.chdir(fixturePath);
    apiUserConfig = userConfig.get('api');
    userConfig.set('api', fakeApiKey);
    isFeatureFlagSupportedForOrgSpy = jest.spyOn(
      featureFlags,
      'isFeatureFlagSupportedForOrg',
    );
  });

  afterAll(() => {
    userConfig.set('api', apiUserConfig);
    process.chdir(cwd);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should fail if we do not have ff', async () => {
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      interactive: false,
      showVulnPaths: 'none',
    };
    isFeatureFlagSupportedForOrgSpy.mockResolvedValueOnce({ code: 401 });

    await expect(
      ecosystems.testEcosystem('code', ['some/path'], {
        code: true,
        ...options,
      }),
    ).rejects.toThrowError(
      /Authentication failed. Please check the API token on/,
    );
  });

  it('succeed testing - with correct exit code', async () => {
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      interactive: false,
      showVulnPaths: 'none',
      code: true,
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isFeatureFlagSupportedForOrgSpy.mockResolvedValueOnce({ ok: true });

    try {
      await ecosystems.testEcosystem('code', ['some/path'], options);
    } catch (error) {
      // exit code 1
      expect(error.code).toBe('VULNS');
      expect(error.message.trim()).toBe(testOutput.trim());
    }
  });

  it('should throw error when response code is not 200', async () => {
    const error = { code: 401, message: 'Invalid auth token' };
    isFeatureFlagSupportedForOrgSpy.mockRejectedValue(error);

    const expected = new Error(error.message);
    try {
      await ecosystems.testEcosystem('code', ['.'], {
        path: '',
        code: true,
      });
    } catch (error) {
      expect(error).toEqual(expected);
    }
  });

  it('analyzeFolders should be called with the right arguments', async () => {
    const baseURL = expect.any(String);
    const sessionToken = fakeApiKey;
    const severity = AnalysisSeverity.info;
    const paths: string[] = ['.'];
    const sarif = true;

    const codeAnalysisArgs = {
      baseURL,
      sessionToken,
      severity,
      paths,
      sarif,
    };

    const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersResponse,
    );
    await getCodeAnalysisAndParseResults('.', {
      path: '',
      code: true,
    });

    expect(analyzeFoldersSpy.mock.calls[0]).toEqual([codeAnalysisArgs]);
  });

  it('analyzeFolders should should return the right sarif response', async () => {
    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    const actual = await getCodeAnalysisAndParseResults('.', {
      path: '',
      code: true,
    });

    expect(actual).toEqual(sampleSarifResponse);
  });
});
