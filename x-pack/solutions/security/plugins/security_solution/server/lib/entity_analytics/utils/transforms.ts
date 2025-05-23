/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { transformError } from '@kbn/securitysolution-es-utils';
import type { ElasticsearchClient, Logger } from '@kbn/core/server';
import type {
  TransformStartTransformResponse,
  TransformPutTransformResponse,
  TransformGetTransformTransformSummary,
  TransformPutTransformRequest,
  TransformGetTransformStatsTransformStats,
  AcknowledgedResponseBase,
} from '@elastic/elasticsearch/lib/api/types';
import murmurhash from 'murmurhash';
import {
  getRiskScoreLatestIndex,
  getRiskScoreTimeSeriesIndex,
} from '../../../../common/entity_analytics/risk_engine';
import type { TransformOptions } from '../risk_score/configurations';
import { getTransformOptions } from '../risk_score/configurations';
import { retryTransientEsErrors } from './retry_transient_es_errors';

export const createTransform = async ({
  esClient,
  transform,
  logger,
}: {
  esClient: ElasticsearchClient;
  transform: TransformPutTransformRequest;
  logger: Logger;
}): Promise<TransformPutTransformResponse | void> => {
  try {
    await esClient.transform.getTransform({
      transform_id: transform.transform_id,
    });

    logger.info(`Transform ${transform.transform_id} already exists`);
  } catch (existErr) {
    const transformedError = transformError(existErr);
    if (transformedError.statusCode === 404) {
      return esClient.transform.putTransform(transform);
    } else {
      logger.error(
        `Failed to check if transform ${transform.transform_id} exists before creation: ${transformedError.message}`
      );
      throw existErr;
    }
  }
};

export const stopTransform = async ({
  esClient,
  logger,
  transformId,
}: {
  esClient: ElasticsearchClient;
  logger: Logger;
  transformId: string;
}): Promise<AcknowledgedResponseBase> =>
  retryTransientEsErrors(
    () =>
      esClient.transform.stopTransform(
        {
          transform_id: transformId,
          wait_for_completion: true,
          force: true,
        },
        { ignore: [409, 404] }
      ),
    { logger }
  );

export const deleteTransform = ({
  esClient,
  logger,
  transformId,
  deleteData = false,
}: {
  esClient: ElasticsearchClient;
  logger: Logger;
  transformId: string;
  deleteData?: boolean;
}): Promise<AcknowledgedResponseBase> =>
  retryTransientEsErrors(
    () =>
      esClient.transform.deleteTransform(
        {
          transform_id: transformId,
          force: true,
          delete_dest_index: deleteData,
        },
        { ignore: [404] }
      ),
    { logger }
  );

export const reinstallTransform = async ({
  esClient,
  logger,
  config,
}: {
  esClient: ElasticsearchClient;
  logger: Logger;
  config: TransformPutTransformRequest;
}): Promise<void> => {
  const transformId = config.transform_id;

  await stopTransform({ esClient, logger, transformId });
  await deleteTransform({ esClient, logger, transformId });
  await createTransform({
    esClient,
    logger,
    transform: config,
  });
};

export const getLatestTransformId = (namespace: string): string => {
  const maxTransformId = 64;
  const prefix = `risk_score_latest_transform_`;
  const fullName = `${prefix}${namespace}`;

  const processedNamespace =
    fullName.length > maxTransformId ? murmurhash.v3(namespace).toString(16) : namespace;
  return `${prefix}${processedNamespace}`;
};

const hasTransformStarted = (transformStats: TransformGetTransformStatsTransformStats): boolean => {
  return transformStats.state === 'indexing' || transformStats.state === 'started';
};

export const scheduleTransformNow = async ({
  esClient,
  transformId,
}: {
  esClient: ElasticsearchClient;
  transformId: string;
}): Promise<void> => {
  const transformStats = await esClient.transform.getTransformStats({
    transform_id: transformId,
  });
  if (transformStats.count <= 0) {
    throw new Error(
      `Unable to find transform status for [${transformId}] while attempting to schedule`
    );
  }

  if (!hasTransformStarted(transformStats.transforms[0])) {
    await esClient.transform.startTransform({
      transform_id: transformId,
    });
  } else {
    await esClient.transform.scheduleNowTransform({
      transform_id: transformId,
    });
  }
};

/**
 * This method updates the transform configuration if it is outdated.
 * If the 'latest' property of the transform changes it will reinstall the transform.
 */
export const upgradeLatestTransformIfNeeded = async ({
  esClient,
  namespace,
  logger,
}: {
  esClient: ElasticsearchClient;
  namespace: string;
  logger: Logger;
}): Promise<TransformStartTransformResponse | void> => {
  const transformId = getLatestTransformId(namespace);
  const latestIndex = getRiskScoreLatestIndex(namespace);
  const timeSeriesIndex = getRiskScoreTimeSeriesIndex(namespace);

  const response = await esClient.transform.getTransform({
    transform_id: transformId,
  });

  const newConfig = getTransformOptions({
    dest: latestIndex,
    source: [timeSeriesIndex],
    namespace,
  });

  if (isTransformOutdated(response.transforms[0], newConfig)) {
    if (doesTransformRequireReinstall(response.transforms[0], newConfig)) {
      logger.info(`Reinstalling transform ${transformId}`);
      await reinstallTransform({
        esClient,
        logger,
        config: { ...newConfig, transform_id: transformId },
      });
    } else {
      logger.info(`Upgrading transform ${transformId}`);
      const { latest: _unused, ...changes } = newConfig;

      await esClient.transform.updateTransform({
        transform_id: transformId,
        ...changes,
      });
    }
  }
};

export const scheduleLatestTransformNow = async ({
  namespace,
  esClient,
  logger,
}: {
  namespace: string;
  esClient: ElasticsearchClient;
  logger: Logger;
}): Promise<void> => {
  const transformId = getLatestTransformId(namespace);

  try {
    await upgradeLatestTransformIfNeeded({ esClient, namespace, logger });
  } catch (err) {
    logger.error(
      `There was an error upgrading the transform ${transformId}. Continuing with transform scheduling. ${err.message}`
    );
  }

  await scheduleTransformNow({ esClient, transformId });
};

const isTransformOutdated = (
  transform: TransformGetTransformTransformSummary,
  newConfig: TransformOptions
): boolean => transform._meta?.version !== newConfig._meta?.version;

const doesTransformRequireReinstall = (
  transform: TransformGetTransformTransformSummary,
  newConfig: TransformOptions
): boolean => JSON.stringify(transform.latest) !== JSON.stringify(newConfig.latest);
