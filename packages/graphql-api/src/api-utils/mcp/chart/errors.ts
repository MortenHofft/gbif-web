export class McpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'McpError';
    this.status = status;
  }
}
