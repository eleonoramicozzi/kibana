/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { EuiFlexGroupProps } from '@elastic/eui';
import { EuiFlexGroup, EuiFlexItem, EuiLoadingChart, EuiText, EuiIcon } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import React from 'react';
import type { AsyncState } from '../hooks/use_async';
import { AsyncStatus } from '../hooks/use_async';

export function AsyncComponent({
  children,
  status,
  error,
  size,
  style,
  alignTop,
}: AsyncState<any> & {
  style?: EuiFlexGroupProps['style'];
  children: React.ReactElement;
  size: 'm' | 'l' | 'xl';
  alignTop?: boolean;
}) {
  if (status === AsyncStatus.Settled && !error) {
    return children;
  }

  return (
    <EuiFlexGroup
      alignItems={alignTop ? 'flexStart' : 'center'}
      justifyContent="center"
      direction="row"
      style={style}
      gutterSize="none"
    >
      <EuiFlexItem grow={false} style={{ alignContent: 'center' }}>
        {error && status === AsyncStatus.Settled ? (
          <EuiFlexGroup direction="row" gutterSize="xs" alignItems="center">
            <EuiFlexItem>
              <EuiIcon type="warning" color="warning" />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiText style={{ whiteSpace: 'nowrap' }}>
                {i18n.translate('xpack.profiling.asyncComponent.errorLoadingData', {
                  defaultMessage: 'Could not load data',
                })}
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        ) : (
          <EuiLoadingChart size={size} />
        )}
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
