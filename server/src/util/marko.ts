/* --------------------------------------------------------------------------------------------
* Copyright (c) Patrick Steele-Idem. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.

Modifications Copyright 2018 eBay Inc.
Author/Developer: Diego Berrocal

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
* ------------------------------------------------------------------------------------------ */

import * as lassoPackageRoot from 'lasso-package-root';
import * as defaultMarkoCompiler from 'marko/compiler';
// @ts-ignore
import * as resolveFrom from 'resolve-from';

const versionRegExp = /^[0-9]+/;
const markoCompilerCache: any = {};
const versionCache: any = {};

type markoCompilerType = typeof defaultMarkoCompiler;

/**
 * Use the project's own marko compiler if available and supported
 * @param dir project directory
 */
function loadMarkoCompiler(dir: string): markoCompilerType {
    const rootDir = lassoPackageRoot.getRootDir(dir);
    if (!rootDir) {
        return defaultMarkoCompiler;
    }

    let markoCompiler = markoCompilerCache[rootDir];
    if (!markoCompiler) {
        // @ts-ignore
        const markoCompilerPath = resolveFrom(rootDir, "marko/compiler");
        if (markoCompilerPath) {
            // @ts-ignore
            const packageJsonPath = resolveFrom(rootDir, "marko/package.json");
            const pkg = require(packageJsonPath);

            const version = pkg.version;
            if (version) {
                const versionMatches = versionRegExp.exec(version);
                if (versionMatches) {
                    const majorVersion = parseInt(versionMatches[0], 10);
                    if (majorVersion >= 3) {
                        markoCompiler = require(markoCompilerPath);
                    }
                }
            }

        }
        markoCompilerCache[rootDir] = (markoCompiler = markoCompiler || defaultMarkoCompiler);
    }

    return markoCompiler;
}

function getMarkoMajorVersion(dir: string) {
    if (!dir) {
        return null;
    }

    const rootDir = lassoPackageRoot.getRootDir(dir);
    if (!rootDir) {
        return;
    }

    let majorVersion = versionCache[rootDir];
    if (majorVersion === undefined) {
        // @ts-ignore
        const packageJsonPath = resolveFrom(rootDir, "marko/package.json");
        if (packageJsonPath) {
            const pkg = require(packageJsonPath);
            const version = pkg.version;
            if (version) {
                const versionMatches = versionRegExp.exec(version);
                if (versionMatches) {
                    majorVersion = parseInt(versionMatches[0], 10);
                }
            }

        }
        versionCache[rootDir] = majorVersion || null;
    }

    return majorVersion;
}

function clearCache() {
    Object.keys(markoCompilerCache).forEach((dir) => {
        const markoCompiler = markoCompilerCache[dir];
        if (!markoCompiler) { return; }
        markoCompiler.clearCaches();
    });
}

export {
    markoCompilerType,
    loadMarkoCompiler,
    clearCache,
    defaultMarkoCompiler,
    getMarkoMajorVersion,
};
