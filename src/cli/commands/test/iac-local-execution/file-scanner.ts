import {
  OpaWasmInstance,
  ParsedIacFile,
  IacFileScanResult,
  PolicyMetadata,
  EngineType,
} from './types';
import { loadPolicy } from '@open-policy-agent/opa-wasm';
import * as fs from 'fs';
import { getLocalCachePath, LOCAL_POLICY_ENGINE_DIR } from './local-cache';

export async function scanFilesForIssues(
  parsedFiles: Array<ParsedIacFile>,
): Promise<IacFileScanResult[]> {
  // TODO: when adding dir support move implementation to queue.
  // TODO: when adding dir support gracefully handle failed scans
  await warmPolicyEngineCache();
  return Promise.all(
    parsedFiles.map(async (file) => {
      const policyEngine = await getPolicyEngine(file.engineType);
      const scanResults = policyEngine.scanFile(file);
      return scanResults;
    }),
  );
}

async function getPolicyEngine(engineType: EngineType): Promise<PolicyEngine> {
  if (policyEngineCache[engineType]) {
    return policyEngineCache[engineType]!;
  }

  policyEngineCache[engineType] = await buildPolicyEngine(engineType);
  return policyEngineCache[engineType]!;
}

async function warmPolicyEngineCache(): Promise<void> {
  await getPolicyEngine(EngineType.Kubernetes);
  await getPolicyEngine(EngineType.Terraform);
  return;
}

const policyEngineCache: { [key in EngineType]: PolicyEngine | null } = {
  [EngineType.Kubernetes]: null,
  [EngineType.Terraform]: null,
};

async function buildPolicyEngine(
  engineType: EngineType,
): Promise<PolicyEngine> {
  const [
    policyEngineCoreDataPath,
    policyEngineMetaDataPath,
  ] = getLocalCachePath(engineType);

  try {
    const wasmFile = fs.readFileSync(policyEngineCoreDataPath);
    const policyMetaData = fs.readFileSync(policyEngineMetaDataPath);
    const policyMetadataAsJson: Record<string, any> = JSON.parse(
      policyMetaData.toString(),
    );

    const opaWasmInstance: OpaWasmInstance = await loadPolicy(
      Buffer.from(wasmFile),
    );
    opaWasmInstance.setData(policyMetadataAsJson);

    return new PolicyEngine(opaWasmInstance);
  } catch (err) {
    throw new Error(
      `Failed to build policy engine from path: ${LOCAL_POLICY_ENGINE_DIR}: \n err: ${err.message}`,
    );
  }
}

class PolicyEngine {
  constructor(private opaWasmInstance: OpaWasmInstance) {
    this.opaWasmInstance = opaWasmInstance;
  }

  private evaluate(data: Record<string, any>): PolicyMetadata[] {
    return this.opaWasmInstance.evaluate(data)[0].result;
  }

  public scanFile(iacFile: ParsedIacFile): IacFileScanResult {
    try {
      const violatedPolicies = this.evaluate(iacFile.jsonContent);
      return {
        ...iacFile,
        violatedPolicies,
      };
    } catch (err) {
      // TODO: to distinguish between different failure reasons
      throw new Error(`Failed to run policy engine: ${err}`);
    }
  }
}
