/*
 * Ant Design form callbacks and Supabase's nested selects both hand back
 * loosely typed records. Rather than sprinkling `any` through the pages, the
 * escape hatch lives here, named, in one place.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type FormValues = Record<string, any>;
export type SupabaseRow = Record<string, any>;
