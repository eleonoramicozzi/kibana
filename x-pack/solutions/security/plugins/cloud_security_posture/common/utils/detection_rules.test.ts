/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CspBenchmarkRuleMetadata } from '@kbn/cloud-security-posture-common/schema/rules/latest';
import {
  convertRuleTagsToMatchAllKQL,
  convertRuleTagsToMatchAnyKQL,
  getFindingsDetectionRuleSearchTagsFromArrayOfRules,
} from './detection_rules';

describe('Detection rules utils', () => {
  it('should convert tags to KQL format with AND operator', () => {
    const inputTags = ['tag1', 'tag2', 'tag3'];

    const result = convertRuleTagsToMatchAllKQL(inputTags);

    const expectedKQL = 'alert.attributes.tags:("tag1" AND "tag2" AND "tag3")';
    expect(result).toBe(expectedKQL);
  });

  it('Should convert tags to KQL format with AND Operator (empty array)', () => {
    const inputTags = [] as string[];

    const result = convertRuleTagsToMatchAllKQL(inputTags);

    const expectedKQL = 'alert.attributes.tags:()';
    expect(result).toBe(expectedKQL);
  });

  it('should convert tags to KQL format with OR Operator', () => {
    const inputTags = ['tag1', 'tag2', 'tag3'];

    const result = convertRuleTagsToMatchAnyKQL(inputTags);

    const expectedKQL = 'alert.attributes.tags:("tag1" OR "tag2" OR "tag3")';
    expect(result).toBe(expectedKQL);
  });

  it('Should convert tags to KQL format with OR Operator  (empty array)', () => {
    const inputTags = [] as string[];

    const result = convertRuleTagsToMatchAnyKQL(inputTags);

    const expectedKQL = 'alert.attributes.tags:()';
    expect(result).toBe(expectedKQL);
  });

  it('Should generate search tags for a CSP benchmark rule given an array of Benchmarks', () => {
    const cspBenchmarkRule = [
      {
        benchmark: {
          id: 'cis_gcp',
          rule_number: '1.1',
        },
      },
      {
        benchmark: {
          id: 'cis_gcp',
          rule_number: '1.2',
        },
      },
    ] as unknown as CspBenchmarkRuleMetadata[];

    const result = getFindingsDetectionRuleSearchTagsFromArrayOfRules(cspBenchmarkRule);

    const expectedTags = ['CIS GCP 1.1', 'CIS GCP 1.2'];
    expect(result).toEqual(expectedTags);
  });

  it('Should handle undefined benchmark object gracefully given an array of empty benchmark', () => {
    const cspBenchmarkRule = [{ benchmark: {} }] as any;
    const expectedTags: string[] = [];
    const result = getFindingsDetectionRuleSearchTagsFromArrayOfRules(cspBenchmarkRule);
    expect(result).toEqual(expectedTags);
  });
});
