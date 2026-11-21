import { amendLastVisit, findBeneficiary, getBeneficiaryHistory, recordVisit, scheduleFollowUp, todaySummary, draftAlert, sendAlert } from './tools';
import { searchGuidelines } from './search-guidelines';
import { executeTool, type ToolContext, type ToolDef } from './define';

// One registry. The MCP route and the agent start route both read it, so names can never drift apart
// (Agora's allowed_tools must match the server's tool names exactly or the agent can hang).
export const TOOLS = [findBeneficiary, getBeneficiaryHistory, recordVisit, amendLastVisit, scheduleFollowUp, todaySummary, draftAlert, sendAlert, searchGuidelines] as const;
export const TOOL_NAMES: string[] = TOOLS.map((t) => t.name);

export { executeTool };
export type { ToolContext, ToolDef };
