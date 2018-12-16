import {promises as fs} from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import {
    TextDocument,
} from 'vscode-languageserver/lib/main';
import URI from 'vscode-uri';

import { loadMarkoCompiler } from '../util/marko';

export async function fileExists(filepath: string) {
    try {
        const stat = await fs.stat(filepath);
        return stat.isFile;
    } catch (err) {
        return false;
    }
}

export async function getComponentJSFilePath(documentPath: string): Promise<string | null> {
    const dir = path.dirname(documentPath);
    const possibleFileNames = [
        "component.js",
        "widget.js",
        "index.js",
    ];

    for (const fileName of possibleFileNames) {
        const filePath = path.join(dir, fileName);
        if (await fileExists(filePath)) {
            return filePath;
        }
    }

    return null;
}

export async function createTextDocument(filename: string): Promise<TextDocument> {
    const uri = URI.file(filename).toString();
    const content = await fs.readFile(filename, "utf8");
    return TextDocument.create(uri, "plaintext", 0, content);
}

export function getTagLibLookup(document: TextDocument) {
    const { path: dir } = URI.parse(document.uri);
    return loadMarkoCompiler(dir).buildTaglibLookup(dir);
}

export function getTag(document: TextDocument, tagName: string) {
    const tagLibLookup = getTagLibLookup(document);
    return tagLibLookup.getTag(tagName);
}

export function getUniqueTags(document: TextDocument) {
    const tagLibLookup = getTagLibLookup(document);
    return _.uniqBy(tagLibLookup.getTagsSorted(), (tag) => {
        return tag.name;
    });
}
