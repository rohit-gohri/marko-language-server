/* --------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.

Modifications Copyright 2018 eBay Inc.
Author/Developer: Diego Berrocal

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
* ------------------------------------------------------------------------------------------ */

import { 
    TextDocumentPositionParams,
    TextDocuments,
    CompletionItem,
    CompletionList,
    Definition
} from "vscode-languageserver/lib/main";
import { IConnection } from 'vscode-languageserver';

import { MLS } from './MLS';
import { loadMarkoCompiler, markoCompilerType } from './util/marko';
import onDefinition from './definition';
import { onCompletion, onCompletionResolve } from "./completion";

/*
NOTE: It would be nice to have a Cache for all the documents that have
been parsed already so we don't have to do it every time.

For now let's just reparse every document we need to.
*/

// TODO: It would be good to have the parser run once instead of each time we need
// to get information from our template. It should have regions

export class Service implements MLS {
    marko : markoCompilerType;
    docManager : TextDocuments;

    constructor(private workspacePath: string, private connection: IConnection) {
        this.workspacePath;
        this.setupLanguageFeatures()
        this.connection.onShutdown(() => {
            this.dispose();
        });
        this.marko = loadMarkoCompiler(workspacePath);
    }

    private setupLanguageFeatures() {
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        this.connection.onDefinition(this.onDefinition.bind(this));
    }

    initialize(workspacePath: string, docManager: TextDocuments) {
        console.log(workspacePath);
        this.docManager = docManager;
    }

    dispose(): void {
        return;
    }

    async onCompletionResolve(item: CompletionItem) {
        return onCompletionResolve(item);
    }

    async onCompletion(positionParams: TextDocumentPositionParams): Promise<CompletionList> {
        return onCompletion(positionParams, this);
    }

    async onDefinition(positionParams: TextDocumentPositionParams): Promise<Definition> {
        return onDefinition(positionParams, this);
    }
}
