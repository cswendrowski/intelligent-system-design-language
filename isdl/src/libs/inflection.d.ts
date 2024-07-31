declare module 'inflection' {
    export function pluralize(str: string): string;
    export function singularize(str: string): string;
    export function capitalize(str: string): string;
    export function camelize(str: string, lowFirstLetter?: boolean): string;
    export function underscore(str: string): string;
    export function humanize(str: string): string;
    export function titleize(str: string): string;
    export function demodulize(str: string): string;
    export function tableize(str: string): string;
    export function classify(str: string): string;
    export function foreign_key(str: string, dropIdUbar?: boolean): string;
    export function ordinalize(str: string): string;
    export function transform(str: string, arr: string[]): string;
}
