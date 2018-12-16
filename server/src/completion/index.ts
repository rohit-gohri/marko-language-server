import {
	CompletionList,
	CompletionItem,
	CompletionItemKind,
    TextDocumentPositionParams,
} from "vscode-languageserver/lib/main";

import { getUniqueTags } from '../documents';
import { MLS } from '../util/MLS';

export async function onCompletion(positionParams: TextDocumentPositionParams, mls: MLS): Promise<CompletionList> {
	const doc = mls.docManager.get(positionParams.textDocument.uri);
	const endPos = positionParams.position;
	endPos.character++;
	const charAtPos = doc.getText({start: positionParams.position, end: endPos});
	// TODO: look at https://github.com/marko-js/atom-language-marko
	try {
		console.log(charAtPos);
		const uniqTags = getUniqueTags(doc);
		
		const result: CompletionList =  {
			items: uniqTags.map((tag): CompletionItem => {
				return {
					label: tag.name,
					kind: CompletionItemKind.Snippet,
					// @ts-ignore
					data: tag.autocomplete,
				}
			}),
			isIncomplete: false,
		};
		return result;
	}
	catch(err) {
		console.error(err);
	}
	return {
		items: [],
		isIncomplete: false,
	};
}

export async function onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
	const autocomplete = item.data;
	if (autocomplete !== undefined) {
		item.documentation = autocomplete.map((ac: {snippet?: string, descriptionMoreURL: string}) => {
			if (ac.snippet === undefined) return ''
			return `Usage: ${ac.snippet}\n` +
				(ac.descriptionMoreURL ? `Read more at [link](${ac.descriptionMoreURL})` : '');
		}).join('\n');
	}
	return item;
}