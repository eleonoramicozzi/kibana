/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { ApmFields, ApmOtelFields, Serializable } from '@kbn/apm-synthtrace-client';
import { Transform } from 'stream';

export function getSerializeTransform<TFields = ApmFields | ApmOtelFields>() {
  const buffer: TFields[] = [];

  let cb: (() => void) | undefined;

  function push(stream: Transform, events: TFields[], callback?: () => void) {
    let event: TFields | undefined;
    while ((event = events.shift())) {
      if (!stream.push(event)) {
        buffer.push(...events);
        cb = callback;
        return;
      }
    }
    callback?.();
  }

  return new Transform({
    objectMode: true,
    read() {
      if (cb) {
        const nextCallback = cb;
        cb = undefined;
        const nextEvents = [...buffer];
        buffer.length = 0;
        push(this, nextEvents, nextCallback);
      }
    },
    // @ts-expect-error upgrade typescript v4.9.5
    write(chunk: Serializable<TFields>, encoding, callback) {
      push(this, chunk.serialize(), callback);
    },
  });
}
