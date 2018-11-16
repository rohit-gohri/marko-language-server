/* --------------------------------------------------------------------------------------------
* Copyright (c) Microsoft Corporation. All rights reserved.
* Licensed under the MIT License. See License.txt in the project root for license information.

Modifications Copyright 2018 eBay Inc.
Author/Developer: Diego Berrocal

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
* ------------------------------------------------------------------------------------------ */

import {promises as fs} from 'fs';
import { createParser } from 'htmljs-parser';
import * as path from 'path';
import { CompletionList, Definition, Position, TextDocument, TextDocumentPositionParams, TextDocuments } from "vscode-languageserver/lib/main";
import { IConnection } from 'vscode-languageserver';
import URI from "vscode-uri";


import { loadMarkoCompiler } from './util/marko';

const tagNameCharsRegExp = /[a-zA-Z0-9_.:-]/;
const attrNameCharsRegExp = /[a-zA-Z0-9_#.:-]/;

const escapeStringRegexp = require('escape-string-regexp');

/*
NOTE: It would be nice to have a Cache for all the documents that have
been parsed already so we don't have to do it every time.

For now let's just reparse every document we need to.
*/

export interface MLS {
    docManager: TextDocuments;
    initialize(workspacePath: string | null | undefined, docManager: TextDocuments): void;
    // configure(config: any): void;
    // format(doc: TextDocument, range: Range, formattingOptions: FormattingOptions): TextEdit[];
    // validate(doc: TextDocument): Diagnostic[];
    onCompletion(positionParams: TextDocumentPositionParams): Promise<CompletionList>;
    // doResolve(doc: TextDocument, languageId: string, item: CompletionItem): CompletionItem;
    // doHover(doc: TextDocument, position: Position): Hover;
    // doSignatureHelp(doc: TextDocument, position: Position): SignatureHelp;
    // findDocumentHighlight(doc: TextDocument, position: Position): DocumentHighlight[];
    // findDocumentSymbols(doc: TextDocument): SymbolInformation[];
    // findDocumentLinks(doc: TextDocument, documentContext: DocumentContext): DocumentLink[];
    onDefinition(positionParams: TextDocumentPositionParams): Promise<Definition>;
    // findReferences(doc: TextDocument, position: Position): Location[];
    // findDocumentColors(doc: TextDocument): ColorInformation[];
    // getColorPresentations(doc: TextDocument, color: Color, range: Range): ColorPresentation[];
    // removeDocument(doc: TextDocument): void;
    dispose(): void;
}

// TODO: It would be good to have the parser run once instead of each time we need
// to get information from our template. It should have regions

enum ScopeType {
    TAG,
    ATTR_NAME,
    ATTR_VALUE,
    NO_SCOPE,
    TEXT
}

interface Scope {
    tagName: string;
    data?: any;
    scopeType: ScopeType
}

async function fileExists(filepath: string){
    try {
        const stat = await fs.stat(filepath);
        return stat.isFile;
    }
    catch(err) {
        return false;
    }
}

async function createTextDocument(filename: string): Promise<TextDocument> {
  const uri = URI.file(filename).toString();
  const content = await fs.readFile(filename, 'utf8');
  return TextDocument.create(uri, 'plaintext', 0, content);
}

async function getComponentJSFilePath(documentPath: string): Promise<string | null> {
    const dir = path.dirname(documentPath);
    const possibleFileNames = [
        'component.js',
        'widget.js',
        'index.js'
    ]

    for (const fileName of possibleFileNames) {
        const filePath = path.join(dir, fileName);
        if (await fileExists(filePath)) {
            return filePath;
        }
    }

    return null;
}

/*
This gives scope at position.

It returns the TAG ScopeType when the cursor is inside an open tag. This complicates the Hover and error messages

 */
async function getScopeAtPos(offset: number, text: string) {
    let found: boolean = false;
    return new Promise(function(resolve: (tag: Scope | boolean) => any) {
        const parser = createParser({
            onOpenTag: function(event) {
                const { pos: startPos, endPos, tagName, tagNameEndPos, attributes} = event;

                // Don't process when the offset is not inside a tag or we found our tag already
                if (found || offset < startPos || offset > endPos) return;
                console.log(`Searching for character '${text[offset]}'
                             in string: '${text.slice(startPos, endPos)}'`);

                found = true
                const defaultTagScope = {
                    tagName,
                    scopeType: ScopeType.NO_SCOPE
                }

                const validCharAtPos = tagNameCharsRegExp.test(text.charAt(offset))
                                      || attrNameCharsRegExp.test(text.charAt(offset));
                if (!validCharAtPos) return resolve(defaultTagScope);

                // Tag Scope
                // If tag name starts with '@' then it's an inner section that should be
                // defined in the marko.json file
                console.log(`Looking in tagName: ${text.slice(startPos, tagNameEndPos)}`)
                if (offset <= tagNameEndPos) {
                    return resolve({
                        tagName,
                        scopeType: ScopeType.TAG
                    });
                }

                for (const attribute of attributes) {
                    // Non event-handling attributes (i.e. not on-* or on*) have their position
                    // set to the position of the value they have.
                    const attrNamePos = attribute.pos - attribute.name.length;
                    // Attributes are ordered and if the start of the attribute
                    // name is higher than the offset, then the offset must be
                    // in a place that doesn't interest us
                    if (offset < attrNamePos) return resolve(defaultTagScope);

                    if (!attribute.argument) {
                        // Check if cursor is on the attribute name
                        console.log(`Looking in attributePosEndPos: ${text.slice(attribute.pos, attribute.endPos)}`)
                        console.log(`Looking in attributeName: ${text.slice(attrNamePos, attribute.pos)}`)
                        // pos and endPos are for the value of the Attribute
                        //  m y - a t t r = " h e l l o "
                        //                ^             ^
                        //               pos          endPos
                        // So we need to make sure the offset is between pos - length of attrName and pos
                        if (offset >= attrNamePos && offset <= attribute.pos) {
                            return resolve({
                                tagName,
                                data: attribute.name,
                                scopeType: ScopeType.ATTR_NAME
                            })
                        }
                    } else {
                        // Cursor is in the argument of `onClick('myOnClickHandler')` like attributes
                        console.log(`Looking in Attribute's Argument: ${text.slice(attribute.argument.pos + 1, attribute.argument.endPos)}`)
                        if (offset >= attribute.argument.pos + 1 && offset <= attribute.argument.endPos) {
                            return resolve({
                                tagName,
                                data: attribute.argument.value.slice(1,-1),
                                scopeType: ScopeType.ATTR_VALUE
                            })
                        }

                    }

                }
                return resolve(defaultTagScope);
            },
            onFinish: function() {
                console.log("================Finished!!!==============")
                // TODO: Maybe this is not right? we need it to resolve somehow
                if(!found) resolve(false)
            },
        })
        parser.parse(text);
    })
}

function getTagLibLookup(document: TextDocument) {
    const { path: dir } = URI.parse(document.uri);
    return loadMarkoCompiler(dir).buildTaglibLookup(dir);
}

function getTag(document:TextDocument, tagName: string) {
    const tagLibLookup = getTagLibLookup(document);
    return tagLibLookup.getTag(tagName);
}

async function findDefinitionForTag(document: TextDocument, { tagName }: Scope): Promise<Definition> {
    const {
      template = false,
      renderer = false,
      taglibId
    } = getTag(document, tagName);

    // We can either have renderers defined where there are no templates.
    if (!template && !renderer) throw new Error(`Couldn't find a definition for tag: ${tagName}`);

    const refPath = template || renderer;

    const definitions = [{
        uri: URI.file(refPath).toString(),
        range: {
            start: Position.create(0, 0),
            end: Position.create(0, 0)
        }
    }];

    if (taglibId && await fileExists(taglibId)) {
      definitions.push({
        uri: URI.file(taglibId).toString(),
        range: {
            start: Position.create(0, 0),
            end: Position.create(0, 0)
        }
      })
    }

    return definitions
}

async function findDefinitionForAttrName(document: TextDocument, { tagName, data: attrName }: Scope) : Promise<Definition> {
    let attrDef = getTagLibLookup(document).getAttribute(tagName, attrName);
    if (!attrDef || !attrDef.filePath) return null;

    const attrDefDocument: TextDocument = await createTextDocument(attrDef.filePath);

    // Search for "@visible"
    const match = attrDefDocument.getText().match(new RegExp(`"@?${escapeStringRegexp(attrName)}"`));
    if (match) {
        const index = match.index;
        return {
            uri: attrDefDocument.uri,
            range: {
                start: attrDefDocument.positionAt(index),
                end: attrDefDocument.positionAt(index + match[0].length)
            }
        };
    }
    return {
        uri: attrDefDocument.uri,
        range: {
            start: Position.create(0, 0),
            end: Position.create(0, 0)
        }
    };
}

async function findDefinitionForAttrValue(document: TextDocument, { data: attrValue }: Scope) : Promise<Definition> {
    const documentPath = URI.parse(document.uri).fsPath
    const componentJSPath = await getComponentJSFilePath(documentPath)

    if (!getComponentJSFilePath) return null;

    const componentJSDocument: TextDocument = await createTextDocument(componentJSPath);
    const handlerRegExp = new RegExp(`${attrValue}\\s*[(]|${attrValue}\\s*[:]`)

    const match = componentJSDocument.getText().match(handlerRegExp);
    if (match) {
        const index = match.index;
        return {
            uri: componentJSDocument.uri,
            range: {
                start: componentJSDocument.positionAt(index),
                end: componentJSDocument.positionAt(index + match[0].length)
            }
        };
    }

    return {
        uri: componentJSDocument.uri,
        range: {
            start: Position.create(0, 0),
            end: Position.create(0, 0)
        }
    };
}

export class MLS {

    constructor(private workspacePath: string, private connection: IConnection) {
        this.workspacePath;
        this.setupLanguageFeatures()
        this.connection.onShutdown(() => {
            this.dispose();
        });
    }

    private setupLanguageFeatures() {
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onDefinition(this.onDefinition.bind(this));
    }

    initialize(workspacePath: string, docManager: TextDocuments) {
        console.log(workspacePath);
        this.docManager = docManager;
    }

    dispose(): void {
        return;
    }



    async onCompletion(positionParams: TextDocumentPositionParams) {
        console.log(positionParams)
        return {
            items:  [{
                "label" : "I'm first"
            }, {
                "label": "I'm second"
            }]
        }
    }

    async onDefinition(positionParams: TextDocumentPositionParams) {
        const doc = this.docManager.get(positionParams.textDocument.uri);
        const offset = doc.offsetAt(positionParams.position);

        const scopeAtPos = <Scope> await getScopeAtPos(offset, doc.getText());
        if (!scopeAtPos) return null;

        const { scopeType } = scopeAtPos;

        switch (scopeType) {
            case (ScopeType.TAG):
                return findDefinitionForTag(doc, scopeAtPos)
            case (ScopeType.ATTR_NAME):
                return findDefinitionForAttrName(doc, scopeAtPos)
            case (ScopeType.ATTR_VALUE):
                return findDefinitionForAttrValue(doc, scopeAtPos)
            default:
                throw(new Error(`Couldn't match the scopeType: ${scopeType}`))
        }

        // do a switch case with the textScope
        // TAG: just return the template + the marko.json file if it exists
        // ATTR_NAME: Return the marko.json file if it exists, and otherwise go to the first usage of input.ATTR_NAME (or all of them)
        // ATTR_VALUE: Check if this is a handler to the ATTR_NAME and return the definition of this handler either in the template or in the component.json
    }
}
