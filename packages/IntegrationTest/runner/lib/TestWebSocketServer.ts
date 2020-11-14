/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @format
 */

import * as _ from 'lodash';
import {Server} from 'ws';

/**
 * A web socket server with behavior expected for the upstream WebSocketTest
 */
export default class TestWebSocketServer {
  private server: Server;

  private constructor(server: Server) {
    this.server = server;
  }

  public static async start(): Promise<TestWebSocketServer> {
    const server = new Server({port: 5555});
    server.on('connection', socket => {
      socket.binaryType = 'arraybuffer';

      socket.on('message', message => {
        const expectedBinary = new Uint8Array([1, 2, 3]).buffer;
        if (_.isEqual(expectedBinary, message)) {
          socket.send(new Uint8Array([4, 5, 6, 7]).buffer);
        } else {
          socket.send(message + '_response');
        }
      });

      socket.send('hello');
    });

    return new Promise((resolve, reject) => {
      server.on('listening', () => resolve(new TestWebSocketServer(server)));
      server.on('error', err => reject(err));
    });
  }

  public close() {
    this.server.close();
  }
}
