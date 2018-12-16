import { 
    Definition,
    Position,
    TextDocument,
    TextDocumentPositionParams,
} from "vscode-languageserver/lib/main";
import { createParser } from 'htmljs-parser';
import URI from "vscode-uri";

import {
	fileExists,
	getTag,
	createTextDocument,
	getTagLibLookup,
	getComponentJSFilePath,
} from '../documents'
import { MLS } from "../util/MLS";

const tagNameCharsRegExp = /[a-zA-Z0-9_.:-]/;
const attrNameCharsRegExp = /[a-zA-Z0-9_#.:-]/;

const escapeStringRegexp = require('escape-string-regexp');

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

/*
 * This gives scope at position.
 * It returns the TAG ScopeType when the cursor is inside an open tag.
 * This complicates the Hover and error messages
 */
export async function getScopeAtPos(offset: number, text: string) {
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

export async function findDefinitionForTag(document: TextDocument, { tagName }: Scope): Promise<Definition> {
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

export async function findDefinitionForAttrName(document: TextDocument, { tagName, data: attrName }: Scope) : Promise<Definition> {
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

export async function findDefinitionForAttrValue(document: TextDocument, { data: attrValue }: Scope) : Promise<Definition> {
    const documentPath = URI.parse(document.uri).fsPath
    const componentJSPath = await getComponentJSFilePath(documentPath)

    if (!componentJSPath) return null;

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

export default async function onDefinition(positionParams: TextDocumentPositionParams, mls: MLS): Promise<Definition> {
    const doc = mls.docManager.get(positionParams.textDocument.uri);
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
