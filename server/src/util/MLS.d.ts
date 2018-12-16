import {
    CompletionItem,
    CompletionList,
    Definition,
    TextDocumentPositionParams,
    TextDocuments,
} from 'vscode-languageserver/lib/main';
import { markoCompilerType } from './marko';


// This is exported seperately so as to not create a circular dependency
export interface MLS {
    marko: markoCompilerType;
    docManager: TextDocuments;
    initialize(workspacePath: string | null | undefined, docManager: TextDocuments): void;
    // configure(config: any): void;
    // format(doc: TextDocument, range: Range, formattingOptions: FormattingOptions): TextEdit[];
    // validate(doc: TextDocument): Diagnostic[];
    onCompletion(positionParams: TextDocumentPositionParams): Promise<CompletionList>;
    onCompletionResolve(item: CompletionItem): Promise<CompletionItem>;
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