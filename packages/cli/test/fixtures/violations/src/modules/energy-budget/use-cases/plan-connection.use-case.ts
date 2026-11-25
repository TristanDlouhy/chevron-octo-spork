export type PlanConnectionInput = { readonly address: string };

export interface PlanConnection {
  execute(input: PlanConnectionInput): boolean;
}
