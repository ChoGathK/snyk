import * as _ from 'lodash';
import tap from 'tap';
import * as sinon from 'sinon';
import * as detect from '../../src/lib/detect';
import * as fs from 'fs';

const port = process.env.PORT || process.env.SNYK_PORT || '12345';

const apiKey = '123456789';
const notAuthorizedApiKey = 'notAuthorized';
let oldkey;
let oldendpoint;
const {test} = tap;

process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';

// tslint:disable-next-line:no-var-requires
const server = require('../cli-server')(
  process.env.SNYK_API, apiKey, notAuthorizedApiKey,
);

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as cli from '../../src/cli/commands';

test('setup', (t) => {
  t.plan(3);
  cli.config('get', 'api').then((key) => {
    oldkey = key; // just in case
    t.pass('existing user config captured');
  });

  cli.config('get', 'endpoint').then((key) => {
    oldendpoint = key; // just in case
    t.pass('existing user endpoint captured');
  });

  server.listen(port, () => {
    t.pass('started demo server');
  });
  cli.config('set', 'api=' + apiKey).then(() => {
    t.pass('api token set');
  }).then(() => {
    return cli.config('unset', 'endpoint').then(() => {
      t.pass('endpoint removed');
    });
  }).catch(t.bailout).then(t.end);
});

test('cli tests for online repos', (t) => {
  t.plan(4);
  cli.test('semver@2').then((res) => {
    t.fail(res);
  }).catch((error) => {
    const res = error.message;
    const pos = res.toLowerCase().indexOf('vulnerability found');
    t.pass(res);
    t.notEqual(pos, -1, 'correctly found vulnerability: ' + res);
  });

  cli.test('semver@2', { json: true }).then((res) => {
    t.fail(res);
  }).catch((error) => {
    const res = JSON.parse(error.message);
    const vuln = res.vulnerabilities[0];
    t.pass(vuln.title);
    t.equal(vuln.id, 'npm:semver:20150403',
      'correctly found vulnerability: ' + vuln.id);
  });
});

test('multiple test arguments', async (t) => {

  cli.test('semver@4', 'qs@6').then((res) => {
    const lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, no vulnerable paths were found.',
      'successfully tested semver@4, qs@6');
  }).catch((error) =>  {
    t.fail(error);
  });

  cli.test('semver@4', 'qs@1').then((res) => {
    t.fail(res);
  }).catch((error) =>  {
    const res = error.message;
    const lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 1 contained vulnerable paths.',
      'successfully tested semver@4, qs@1');
  });

  cli.test('semver@2', 'qs@6').then((res) => {
    t.fail(res);
  }).catch((error) =>  {
    const res = error.message;
    const lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 1 contained vulnerable paths.',
      'successfully tested semver@2, qs@6');
  });

  cli.test('semver@2', 'qs@1').then((res) => {
    t.fail(res);
  }).catch((error) =>  {
    const res = error.message;
    const lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 2 contained vulnerable paths.',
      'successfully tested semver@2, qs@1');
  });
});

test('test for existing remote package with dev-deps only with --dev', async (t) => {
  try {
    const res = await cli.test('lodash@4.17.11', {dev: true});
    const lastLine = res.trim().split('\n').pop();
    t.deepEqual(lastLine, '✓ Tested lodash@4.17.11 for known vulnerabilities, no vulnerable paths found.',
      'successfully tested lodash@4.17.11');
  } catch (error) {
    t.fail('should not throw, instead received error: ' + error);
  }
});

test('test for existing remote package with dev-deps only', async (t) => {
  try {
    const res = await cli.test('lodash@4.17.11');
    const lastLine = res.trim().split('\n').pop();
    t.deepEqual(lastLine, 'Tip: Snyk only tests production dependencies by default ' +
    '(which this project had none). Try re-running with the `--dev` flag.',
    'tip text as expected');
  } catch (error) {
    t.fail('should not throw, instead received error: ' + error);
  }
});

test('test for non-existing package@version', (t) => {
  cli.test('nonexistent@version').then((res) => {
    t.fails('should fail, instead received ' + res);
    t.end();
  }).catch((error) =>  {
    t.equal(error.userMessage, 'Failed to get vulnerabilities. Are you sure this is a package?');
    t.equal(error.code, 404);
    t.deepEqual(error.message, 'Failed to get vulns for package.');
  });
});

tap.teardown('teardown', (t) => {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  server.close(() => {
    t.pass('server shutdown');
    let key = 'set';
    let value = 'api=' + oldkey;
    if (!oldkey) {
      key = 'unset';
      value = 'api';
    }
    cli.config(key, value).then(() => {
      t.pass('user config restored');
      if (oldendpoint) {
        cli.config('endpoint', oldendpoint).then(() => {
          t.pass('user endpoint restored');
          t.end();
        });
      } else {
        t.pass('no endpoint');
        t.end();
      }
    });

  });
});