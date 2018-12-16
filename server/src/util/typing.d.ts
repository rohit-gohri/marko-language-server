/*
Copyright 2018 eBay Inc.
Author/Developer: Diego Berrocal

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
*/

declare module 'marko/compiler' {
    export * from 'marko/src/compiler';    
}

declare module 'lasso-package-root';

declare module 'htmljs-parser' {
    type argument = {
        value: string;
        pos: number;
        endPos: number;
    };

    type eventTypes = 'text' | 'placeholder' | 'cdata' | 'openTag' | 'closeTag' |
        'declaration' | 'comment' | 'scriptlet' | 'error';

    type errorCodes = 'MISSING_END_TAG' |
    'MISSING_END_DELIMITER' |
    'MALFORMED_OPEN_TAG' |
    'MALFORMED_CLOSE_TAG' |
    'MALFORMED_CDATA' |
    'MALFORMED_PLACEHOLDER' |
    'MALFORMED_DOCUMENT_TYPE' |
    'MALFORMED_DECLARATION' |
    'MALFORMED_COMMENT' |
    'EXTRA_CLOSING_TAG' |
    'MISMATCHED_CLOSING_TAG';

    interface listeners {
        onText?: (event?: {
            /**
             * Text within an HTML element
             */
            value: string;
        }) => any;
        onPlaceholder?: (event?: {
            value: string;
            /**
             * ${<value>]} // escape = true
             * $!{<value>]} // escape = false
             */
            escaped: boolean;
            withinBody?: boolean;
            withinAttribute?: boolean;
            withinString?: boolean;
            withinOpenTag?: boolean;
            pos: number;
        }) => any;
        onCDATA?: (event?: {
            /**
             * <![CDATA[<value>]]>
             */
            value: string;
            pos: number;
        }) => any;
        onOpenTag?: (event?: {
            tagName: string;
            attributes: {
                name: string;
                value?: string;
                literalValue?: any;
                argument?: argument;
                pos: number;
                endPos: number;
            }[];
            argument: argument;
            pos: number;
            endPos: number;
            tagNameEndPos: number;
        }) => any;
        onCloseTag?: (event?: {
            tagName: string;
            pos: number;
        }) => any;
        onDocumentType?: (event?: {
            /**
             * Document Type/DTD
             * <!<value>>
             * Example: <!DOCTYPE html>
             */
            value: string;
            pos: number;
        }) => any;
        onDeclaration?: (event?: {
            /**
             * Declaration
             * <?<value>?>
             * Example: <?xml version="1.0" encoding="UTF-8" ?>
             */
            value: string;
            pos: number;
        }) => any;
        onComment?: (event?: {
            /**
             * Text within XML comment
             */
            value: string;
            pos: number;
        }) => any;
        onScriptlet?: (event?: {
            /**
             * Text within <% %>
             */
            value: string;
            pos: number;
        }) => any;
        onError?: (event?: {
            /**
             * Error
             */
            message: string;
            code: errorCodes;
            pos: number;
        }) => any;
        onFinish?: (event?: {}, parser?: Parser) => any;
    }

    interface options {
        concise: boolean;
        isOpenTagOnly: boolean;
        ignorePlaceholders: boolean;
        legacyCompatibility: boolean;
        reflectiveAttributes: boolean;
    }

    class Parser  {
        constructor(listeners: listeners, options: options);
        parse(data: null | string | string[], filename?: string): void;
    }

    export function createParser(listeners: listeners, options?: options): Parser;
}
