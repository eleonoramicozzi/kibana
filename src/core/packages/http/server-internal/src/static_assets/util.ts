/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { URL, format } from 'node:url';

function isEmptyPathname(pathname: string): boolean {
  return !pathname || pathname === '/';
}

function removeTailSlashes(pathname: string): string {
  let updated = pathname;

  while (updated.endsWith('/')) {
    updated = updated.substring(0, updated.length - 1);
  }

  return updated;
}

function removeLeadSlashes(pathname: string): string {
  let updated = pathname;

  while (updated.startsWith('/')) {
    updated = updated.substring(1);
  }

  return updated;
}

export function removeSurroundingSlashes(pathname: string): string {
  return removeLeadSlashes(removeTailSlashes(pathname));
}

export function suffixPathnameToURLPathname(urlString: string, pathname: string): string {
  const url = new URL(urlString);
  url.pathname = suffixPathnameToPathname(url.pathname, pathname);
  return format(url);
}

/**
 * Appends a value to pathname. Pathname is assumed to come from URL.pathname
 * Also do some quality control on the path to ensure that it matches URL.pathname.
 */
export function suffixPathnameToPathname(pathnameA: string, pathnameB: string): string {
  if (isEmptyPathname(pathnameA)) {
    return `/${removeSurroundingSlashes(pathnameB)}`;
  }
  if (isEmptyPathname(pathnameB)) {
    return `/${removeSurroundingSlashes(pathnameA)}`;
  }
  return `/${removeSurroundingSlashes(pathnameA)}/${removeSurroundingSlashes(pathnameB)}`;
}
