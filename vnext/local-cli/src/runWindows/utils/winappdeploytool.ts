/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 * @format
 */

import * as fs from 'fs';
import * as path from 'path';
const execSync = require('child_process').execSync;
import {newSpinner, commandWithProgress, newWarn} from './commandWithProgress';

function sortDevices(l, r) {
  return l.toString().length > r.toString().length;
}

class DeviceInfo {
  public guid;
  public ip;

  private index;
  private name;
  private type;

  constructor(deviceIndex, deviceName, deviceType) {
    this.index = deviceIndex;
    this.name = deviceName;
    this.type = deviceType;
  }

  toString() {
    return `${this.index}. ${this.name} (${this.type})`;
  }
}

export default class WinAppDeployTool {
  private path;

  constructor() {
    const programFilesPath =
      process.env['ProgramFiles(x86)'] || process.env.ProgramFiles;
    this.path = path.join(
      programFilesPath,
      'Windows Kits',
      '10',
      'bin',
      'x86',
      'WinAppDeployCmd.exe',
    );
  }

  get isAvailable() {
    return fs.existsSync(this.path);
  }

  findDevice(target) {
    const devices = this.enumerateDevices();

    if (devices.length === 0) {
      throw new Error('No devices found');
    }

    if (target === 'emulator') {
      const sortedList = devices.sort(sortDevices);
      for (let i = 0; i < sortedList.length; i++) {
        const sortedItem = sortedList[i];
        if (sortedItem.toString().indexOf(target) > -1) {
          return sortedItem;
        }
      }
    }

    if (target === 'device') {
      return devices[0];
    }

    const candidateList = devices.filter(device => device.guid === target);

    if (candidateList.length > 0) {
      return candidateList[0];
    } else {
      throw new Error('No devices found');
    }
  }

  enumerateDevices() {
    // 127.0.0.1   00000015-b21e-0da9-0000-000000000000    Lumia 1520 (RM-940)\r
    //  maps to
    // [(line), '127.0.0.1', '00000015-b21e-0da9-0000-000000000000', 'Lumia 1520 (RM-940)']
    // The expansion is: IP address, spaces, GUID, spaces, text name
    const LINE_TEST = /^([\d\.]+?)\s+([\da-fA-F\-]+?)\s+(.+)$/m; // eslint-disable-line no-useless-escape

    const result = execSync(`"${this.path}" devices`).toString();
    const lines = result.split('\r\n');
    const matchedLines = lines.filter(line => LINE_TEST.test(line));

    const devices = matchedLines.map((line, arrayIndex) => {
      const match = line.match(LINE_TEST);
      const ip = match[1];
      const guid = match[2];
      const name = match[3];
      const type = 'device';

      const deviceInfo = new DeviceInfo(arrayIndex, name, type);
      deviceInfo.ip = ip;
      deviceInfo.guid = guid;

      return deviceInfo;
    });

    return devices;
  }

  async installAppPackage(
    pathToAppxPackage,
    targetDevice,
    shouldLaunch,
    shouldUpdate,
    pin,
    verbose: boolean = false,
  ) {
    const text = `Installing app to ${targetDevice.name}`;

    if (shouldLaunch) {
      newWarn(
        'Cannot launch app with current version of Windows 10 SDK tools.  You will have to launch the app after installation is completed.',
      );
    }

    const args = [
      shouldUpdate ? 'update' : 'install',
      '-file',
      pathToAppxPackage,
      '-ip',
      targetDevice.ip,
    ];

    if (pin) {
      args.push('-pin', pin);
    }
    await commandWithProgress(newSpinner(text), text, this.path, args, verbose);
  }

  async uninstallAppPackage(packageInfo, targetDevice, verbose) {
    const text = `Uninstalling app from ${targetDevice.name}`;
    await commandWithProgress(
      newSpinner(text),
      text,
      this.path,
      `uninstall -package ${packageInfo} -ip {$targetDevice.ip}`.split(' '),
      verbose,
    );
  }
}
