import type * as z from 'zod'
import type { DateString } from '../../src/data/dates.ts'
import type { Shards } from '../data.ts'

export interface ToolContext {
  shards: Shards
  /** Origin the request arrived on, used for absolute URLs in results. */
  site: string
  /** Today's date in Vancouver. */
  today: DateString
}

export interface ToolResult<T> {
  structuredContent: T
  /** Text for the model; the same data as markdown, or JSON where a client contract needs it. */
  text: string
  isError?: boolean
}

type Shape = z.ZodObject<z.ZodRawShape>

export interface ToolDef<In extends Shape = Shape, Out extends Shape = Shape> {
  name: string
  title: string
  description: string
  inputSchema: In
  outputSchema: Out
  // A method signature keeps concrete tools assignable to the wide `ToolDef` type.
  handler(args: z.output<In>, ctx: ToolContext): Promise<ToolResult<z.output<Out> | undefined>>
}

export function defineTool<In extends Shape, Out extends Shape>(
  def: ToolDef<In, Out>,
): ToolDef<In, Out> {
  return def
}

/** A failed lookup, phrased for the model. */
export function failure(text: string): ToolResult<undefined> {
  return { structuredContent: undefined, text, isError: true }
}
