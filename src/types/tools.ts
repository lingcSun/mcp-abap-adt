export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        optional?: boolean;
      }
    >;
    required?: string[];
  };
}
