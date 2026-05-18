export class McpError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'McpError';
    this.status = status;
    this.details = details;
  }
}
