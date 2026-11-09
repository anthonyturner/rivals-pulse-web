// What Postgres and PostgREST answer when a migration has not been applied yet: PGRST202 is "no
// such function in the schema cache", 42883 an undefined function and 42P01 an undefined table.
const NOT_APPLIED_CODES: ReadonlySet<string> = new Set(['PGRST202', '42883', '42P01']);

/** True for an error code that means the function, or a table it reads, is not in the database yet. */
export function isNotAppliedCode(code: string | undefined): boolean {
  return code !== undefined && NOT_APPLIED_CODES.has(code);
}
