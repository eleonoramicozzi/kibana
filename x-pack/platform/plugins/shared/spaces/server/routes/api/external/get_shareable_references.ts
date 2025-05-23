/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';

import type { ExternalRouteDeps } from '.';
import { wrapError } from '../../../lib/errors';
import { createLicensedRouteHandler } from '../../lib';

export function initGetShareableReferencesApi(deps: ExternalRouteDeps) {
  const { router, getStartServices, isServerless } = deps;

  router.post(
    {
      path: '/api/spaces/_get_shareable_references',
      security: {
        authz: {
          enabled: false,
          reason:
            'This route delegates authorization to the spaces service via a scoped spaces client',
        },
      },
      options: {
        access: isServerless ? 'internal' : 'public',
        summary: `Get shareable references`,
        tags: ['oas-tag:spaces'],
        description: 'Collect references and space contexts for saved objects.',
      },
      validate: {
        body: schema.object({
          objects: schema.arrayOf(schema.object({ type: schema.string(), id: schema.string() })),
        }),
      },
    },
    createLicensedRouteHandler(async (context, request, response) => {
      const [startServices] = await getStartServices();
      const scopedClient = startServices.savedObjects.getScopedClient(request);

      const { objects } = request.body;

      try {
        const collectedObjects = await scopedClient.collectMultiNamespaceReferences(objects, {
          purpose: 'updateObjectsSpaces',
        });
        return response.ok({ body: collectedObjects });
      } catch (error) {
        return response.customError(wrapError(error));
      }
    })
  );
}
