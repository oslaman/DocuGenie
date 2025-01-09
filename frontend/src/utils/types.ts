/**
 * Type for the status of a resource.
 * @type {("loading" | "failed to load" | "available" | "unavailable")}
 */
type Status = "loading" | "failed to load" | "available" | "unavailable";

export type RuleItems = {
    [x: string]: any
    id: string
    name: string
    salience: number
    children: number
}