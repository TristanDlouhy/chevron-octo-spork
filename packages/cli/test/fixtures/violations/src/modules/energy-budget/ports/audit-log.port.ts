export interface Auditable {
  audit(entry: string): void;
}

export interface AuditLog extends Auditable {
  flush(): void;
}
