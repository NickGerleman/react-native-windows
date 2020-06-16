/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @format
 * @ts-check
 */

const _ = require('lodash');
const chalk = require('chalk');
const child_process = require('child_process');
const findUp = require('find-up');
const fs = require('fs');
const path = require('path');
const simplegit = require('simple-git/promise');
const util = require('util');
const yaml = require('js-yaml');
const yargs = require('yargs');

const glob = util.promisify(require('glob').glob);

(async () => {
  const argv = collectArgs();
  const git = simplegit();
  const branchName = `${argv.rnVersion}-stable`;
  const commitMessage = `Promote ${argv.rnVersion} to ${argv.release}`;

  if (argv.release === 'preview') {
    console.log(`Creating branch ${branchName}...`);
    await git.checkoutBranch(branchName, 'HEAD');
  } else {
    console.log(`Checking out ${branchName}...`);
    await git.checkoutLocal(branchName);
  }

  console.log('Updating Beachball configuration...');
  await updateBeachballConfigs(argv.release, argv.rnVersion);

  console.log('Updating CI variables...');
  await writeAdoVariables({npmTag: distTag(argv.release, argv.rnVersion)});

  if (argv.release === 'preview') {
    console.log('Updating root change script...');
    await updatePackage('react-native-windows-repo', {
      scripts: {change: `beachball change --branch ${branchName}`},
    });

    console.log('Updating package versions...');
    await updatePackageVersions(`${argv.rnVersion}-preview.0`);
  }

  console.log('Committing changes...');
  await git.commit(commitMessage);

  console.log('Generating change files...');
  if (argv.release === 'preview') {
    await createChangeFiles('prerelease', commitMessage);
  } else {
    await createChangeFiles('patch', commitMessage);
  }

  console.log(
    chalk.green(
      'All done! Please check locally commited changes and push or create a PR.',
    ),
  );
})();

/**
 * Parse and validate program arguments
 *
 * @returns {yars.argv} arguments object
 */
function collectArgs() {
  const argv = yargs
    .options({
      release: {
        describe: 'What release channel to promote to',
        choices: ['preview', 'latest', 'legacy'],
        demandOption: true,
      },
      rnVersion: {
        describe: 'The semver major + minor version of the release (e.g. 0.62)',
        type: 'string',
        demandOption: true,
      },
    })
    .wrap(120)
    .version(false).argv;

  if (argv.rnVersion && !argv.rnVersion.match(/\d+\.\d+/)) {
    console.error(chalk.red('Unexpected format for version (expected x.y)'));
    process.exit(1);
  }

  return argv;
}

/**
 * Write release variables to be used by CI
 *
 * @param {object} vars object describing CI variables
 */
async function writeAdoVariables(vars) {
  const adoPath = await findUp('.ado', {type: 'directory'});
  const releaseVariablesPath = path.join(adoPath, 'variables', 'release.yml');

  const releaseVariablesContent =
    '# Warning: This file is autogenerated by packages/scripts/promoteRelease.js\n' +
    yaml.dump({variables: vars});
  await fs.promises.writeFile(releaseVariablesPath, releaseVariablesContent);
}

/**
 * Modifies beachball configurations to the right npm tag and version bump
 * restrictions
 *
 * @param {string} release the release type
 * @param {string} version major + minor version
 */
async function updateBeachballConfigs(release, version) {
  for (const packageName of [
    '@office-iss/react-native-win32',
    'react-native-windows',
  ]) {
    await updateBeachballConfig(packageName, release, version);
  }
}

/**
 * Modifies beachball config to the right npm tag and version bump restrictions
 *
 * @param {string} packageName name of the package to update
 * @param {string} release the release type
 * @param {string} version major + minor version
 */
async function updateBeachballConfig(packageName, release, version) {
  switch (release) {
    case 'preview':
      return updatePackage(packageName, {
        beachball: {
          defaultNpmTag: distTag(release, version),
          disallowedChangeTypes: ['major', 'minor', 'patch'],
        },
      });

    case 'latest':
      return updatePackage(packageName, {
        beachball: {
          defaultNpmTag: distTag(release, version),
          disallowedChangeTypes: ['major', 'minor', 'prerelease'],
        },
      });

    case 'legacy':
      return updatePackage(packageName, {
        beachball: {
          defaultNpmTag: distTag(release, version),
          disallowedChangeTypes: ['major', 'minor', 'prerelease'],
        },
      });
  }
}

/**
 * Assign properties to the npm package of the given name
 *
 * @param {string} packageName
 * @param {object} props
 */
async function updatePackage(packageName, props) {
  const repoRoot = await findRepoRoot();
  const packages = await glob('**/package.json', {
    cwd: repoRoot,
    ignore: '**/node_modules/**',
  });

  for (const packageFile of packages) {
    const fullPath = path.join(repoRoot, packageFile);
    const packageJson = JSON.parse(await fs.promises.readFile(fullPath));
    if (packageJson.name !== packageName) {
      continue;
    }

    _.merge(packageJson, props);
    await fs.promises.writeFile(
      fullPath,
      JSON.stringify(packageJson, null /*replacer*/, 2 /*space*/) + '\n',
    );
    return;
  }

  console.error(chalk.red(`Unable to find package ${packageName}`));
  process.exit(1);
}

/**
 * Find the root directory of the repo
 */
async function findRepoRoot() {
  const rootPackage = await findUp('package.json', {cwd: '..'});
  return path.dirname(rootPackage);
}

/**
 * Get the npm distribution tag for a given version
 *
 * @param {string} release
 * @param {string} version
 */
function distTag(release, version) {
  if (release === 'legacy') {
    return `v${version}-stable`;
  } else {
    return release;
  }
}

/**
 * Change the version of main packages to the given string
 * @param {string} packageVersion
 */
async function updatePackageVersions(packageVersion) {
  for (const packageName of [
    '@office-iss/react-native-win32',
    'react-native-windows',
  ]) {
    await updatePackage(packageName, {version: packageVersion});
  }
}

/**
 * Create change files to do a version bump
 *
 * @param {string} changeType prerelease or patch
 * @param {string} message changelog message
 */
async function createChangeFiles(changeType, message) {
  const repoRoot = await findRepoRoot();
  child_process.execSync(
    `npx beachball change --type ${changeType} --message ${message}`,
    {cwd: repoRoot, stdio: 'ignore'},
  );
}
