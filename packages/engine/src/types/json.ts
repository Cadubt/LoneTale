/**
 * Valores JSON primitivos aceitos em flags, variaveis e metadados.
 * Mantido estreito de proposito: o conteudo de uma aventura nunca carrega codigo.
 */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/** Identificador estavel declarado no JSON da aventura. */
export type Id = string;
