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
    createConnection, Diagnostic, InitializeResult,
    TextDocument, TextDocuments,
} from 'vscode-languageserver';

import { Service } from './service';

// Create a connection for the server
const connection =
    process.argv.length <= 2
        ? createConnection(process.stdin, process.stdout) // no arg specified
        : createConnection();

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

let mls: Service;

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments = new TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites.
let workspaceRoot: string;
connection.onInitialize((params): InitializeResult => {
    workspaceRoot = params.rootPath;
    mls = new Service(workspaceRoot, connection);

    mls.initialize(workspaceRoot, documents);
    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
            // Tell the client that we have reference provider as well
            definitionProvider: true,
            completionProvider: { resolveProvider: true, triggerCharacters: [".", ":", "<", '"', "'", "/", "@", "*"] },
        },
    };
});

function validateTextDocument(textDocument: TextDocument): void {
    const diagnostics: Diagnostic[] = [];
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    validateTextDocument(change.document);
});

// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration(() => {
    // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
});

connection.onDidChangeWatchedFiles(() => {
    // ({changes})
    // Monitored files have change in VSCode
    connection.console.log("We recevied an file change event");
});

// Listen on the connection
connection.listen();
